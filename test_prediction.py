import numpy as np
import tensorflow as tf
import xarray as xr
from pathlib import Path

def masked_mse(y_true, y_pred):
    mask = tf.cast(tf.not_equal(y_true, 0.0), tf.float32)
    squared_error = tf.square((y_true - y_pred) * mask)
    return tf.reduce_sum(squared_error) / (tf.reduce_sum(mask) + 1e-6)

def masked_rmse(y_true, y_pred):
    return tf.sqrt(masked_mse(y_true, y_pred))

def masked_bias(y_true, y_pred):
    mask = tf.cast(tf.not_equal(y_true, 0.0), tf.float32)
    error = (y_pred - y_true) * mask
    return tf.reduce_sum(error) / (tf.reduce_sum(mask) + 1e-6)

def masked_correlation(y_true, y_pred):
    mask = tf.cast(tf.not_equal(y_true, 0.0), tf.float32)
    N = tf.reduce_sum(mask)
    mean_true = tf.reduce_sum(y_true * mask) / (N + 1e-6)
    mean_pred = tf.reduce_sum(y_pred * mask) / (N + 1e-6)
    true_centered = (y_true - mean_true) * mask
    pred_centered = (y_pred - mean_pred) * mask
    cov = tf.reduce_sum(true_centered * pred_centered)
    var_true = tf.reduce_sum(tf.square(true_centered))
    var_pred = tf.reduce_sum(tf.square(pred_centered))
    return cov / (tf.sqrt(var_true * var_pred) + 1e-6)

print("1. Loading Residual Model and Dataset...")
custom_objects = {
    'masked_mse': masked_mse,
    'masked_rmse': masked_rmse,
    'masked_bias': masked_bias,
    'masked_correlation': masked_correlation
}
model = tf.keras.models.load_model("models/ocean_spatial_cnn.keras", custom_objects=custom_objects)

data = np.load("data/spatial_dataset.npz")
X = data['X_train']
Y = data['Y_train']
ocean_mask = data['ocean_mask']
depth_levels = data['depths']

data_nc = Path("data/SIH_Training_Full.nc")
if not data_nc.exists():
    data_nc = Path("data/SIH_Test_Sample.nc")
ds = xr.open_dataset(data_nc)
lats = ds.latitude.values
lons = ds.longitude.values

print("2. Generating Grid Predictions...")
pred_grid = model.predict(X[0:1], verbose=0)[0]
act_grid = Y[0]

def evaluate_location(region_name, target_lat, target_lon):
    lat_idx = np.abs(lats - target_lat).argmin()
    lon_idx = np.abs(lons - target_lon).argmin()

    print("\n" + "=" * 62)
    print(f"REGION: {region_name} ({lats[lat_idx]:.2f}°N, {lons[lon_idx]:.2f}°E)")
    print("=" * 62)

    if not ocean_mask[lat_idx, lon_idx]:
        print("Selected coordinate is on land.")
        return

    preds = pred_grid[lat_idx, lon_idx]
    acts = act_grid[lat_idx, lon_idx]

    print(f"{'Depth':>7} | {'Predicted':>10} | {'Actual':>10} | {'Error':>10}")
    print("-" * 62)
    errors = []
    for d, p, a in zip(depth_levels, preds, acts):
        if a == 0.0:
            print(f"{int(d):>6}m | {'Seafloor / Masked':^38}")
            continue
        diff = p - a
        errors.append(abs(diff))
        sign = "+" if diff >= 0 else ""
        print(f"{int(d):>6}m | {p:9.2f}°C | {a:9.2f}°C | {sign}{diff:8.2f}°C")

    print("-" * 62)
    print(f"Point Mean Absolute Error (MAE): {np.mean(errors):.3f}°C")

evaluate_location("Central Arabian Sea", 15.0, 65.0)
evaluate_location("Bay of Bengal", 14.0, 88.0)
evaluate_location("Equatorial Indian Ocean", 5.5, 75.0)

print("\n" + "=" * 62)
print("BASIN-WIDE METRICS (All Ocean Cells)")
print("=" * 62)
valid_mask = (act_grid != 0.0)
valid_p = pred_grid[valid_mask]
valid_a = act_grid[valid_mask]

mae = np.mean(np.abs(valid_p - valid_a))
rmse = np.sqrt(np.mean((valid_p - valid_a) ** 2))
bias = np.mean(valid_p - valid_a)
corr = np.corrcoef(valid_p, valid_a)[0, 1]

print(f"Overall MAE         : {mae:.4f}°C")
print(f"Overall RMSE        : {rmse:.4f}°C")
print(f"Overall Bias        : {bias:.4f}°C")
print(f"Pearson Correlation : {corr:.4f}")
print("=" * 62)