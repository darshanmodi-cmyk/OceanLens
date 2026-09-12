import numpy as np
import tensorflow as tf
import tensorflow.keras.backend as K
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, Conv2D, BatchNormalization, LeakyReLU, Add
from tensorflow.keras.callbacks import ReduceLROnPlateau

print("1. Loading Spatial Dataset...")
data = np.load("data/spatial_dataset.npz")
X_train = data['X_train']  
Y_train = data['Y_train']  
ocean_mask = data['ocean_mask']

# Calculate the mean temperature at each depth to initialize the network bias.
# This instantly eliminates the -2.55°C systemic bias.
valid_y = Y_train[:, ocean_mask, :]
y_mean_init = np.mean(valid_y, axis=(0, 1))

print("2. Defining Masked Loss and Custom INCOIS Metrics...")
def masked_mse(y_true, y_pred):
    mask = tf.cast(tf.not_equal(y_true, 0.0), tf.float32)
    squared_error = tf.square((y_true - y_pred) * mask)
    return tf.reduce_sum(squared_error) / (tf.reduce_sum(mask) + K.epsilon())

def masked_rmse(y_true, y_pred):
    return tf.sqrt(masked_mse(y_true, y_pred))

def masked_bias(y_true, y_pred):
    mask = tf.cast(tf.not_equal(y_true, 0.0), tf.float32)
    error = (y_pred - y_true) * mask
    return tf.reduce_sum(error) / (tf.reduce_sum(mask) + K.epsilon())

def masked_correlation(y_true, y_pred):
    mask = tf.cast(tf.not_equal(y_true, 0.0), tf.float32)
    N = tf.reduce_sum(mask)
    
    mean_true = tf.reduce_sum(y_true * mask) / (N + K.epsilon())
    mean_pred = tf.reduce_sum(y_pred * mask) / (N + K.epsilon())
    
    true_centered = (y_true - mean_true) * mask
    pred_centered = (y_pred - mean_pred) * mask
    
    covariance = tf.reduce_sum(true_centered * pred_centered)
    var_true = tf.reduce_sum(tf.square(true_centered))
    var_pred = tf.reduce_sum(tf.square(pred_centered))
    
    return covariance / (tf.sqrt(var_true * var_pred) + K.epsilon())

print("3. Building Deep Residual Spatial Network...")
inputs = Input(shape=(X_train.shape[1], X_train.shape[2], X_train.shape[3]), name="Surface_Grid")

# Initial Feature Extraction
x = Conv2D(64, kernel_size=(3, 3), padding='same')(inputs)
x = LeakyReLU(alpha=0.1)(x)
x = BatchNormalization()(x)

# Residual Block 1
res1 = x
x = Conv2D(64, kernel_size=(3, 3), padding='same')(x)
x = LeakyReLU(alpha=0.1)(x)
x = BatchNormalization()(x)
x = Conv2D(64, kernel_size=(3, 3), padding='same')(x)
x = Add()([res1, x])  # Skip connection to prevent vanishing gradients
x = LeakyReLU(alpha=0.1)(x)

# Residual Block 2 (Expansion)
x = Conv2D(128, kernel_size=(3, 3), padding='same')(x)
res2 = x
x = Conv2D(128, kernel_size=(3, 3), padding='same')(x)
x = LeakyReLU(alpha=0.1)(x)
x = BatchNormalization()(x)
x = Conv2D(128, kernel_size=(3, 3), padding='same')(x)
x = Add()([res2, x])
x = LeakyReLU(alpha=0.1)(x)

# Final 1x1 Convolution mapped to target depth levels
# bias_initializer forces the network to start predicting the exact ocean average instantly
bias_init = tf.keras.initializers.Constant(y_mean_init)
outputs = Conv2D(
    Y_train.shape[-1], 
    kernel_size=(1, 1), 
    padding='same', 
    activation='linear', 
    bias_initializer=bias_init,
    name="Depth_Reconstruction"
)(x)

model = Model(inputs, outputs)
optimizer = tf.keras.optimizers.AdamW(learning_rate=2e-3)

model.compile(
    optimizer=optimizer, 
    loss=masked_mse, 
    metrics=[masked_rmse, masked_bias, masked_correlation]
)

print("4. Training Residual Model...")
reduce_lr = ReduceLROnPlateau(monitor='loss', factor=0.5, patience=10, min_lr=1e-6, verbose=1)

model.fit(
    X_train, Y_train,
    epochs=100,
    batch_size=1,
    callbacks=[reduce_lr],
    verbose=1
)

model.save("models/ocean_spatial_cnn.keras")
print("-> Deep Residual model saved successfully.")