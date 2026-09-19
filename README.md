# OceanEmbed

### Satellite Embedding-Based Deep Learning Framework for Reconstruction of Subsurface Ocean Temperature from Surface Satellite Observations

OceanEmbed is a prototype developed for **Smart India Hackathon 2026 – Problem Statement 26066**, under the **Ministry of Earth Sciences**.

The idea is to combine broad surface ocean observations with sparse subsurface measurements from Argo floats and use deep learning to reconstruct subsurface ocean temperature.

## Problem

Satellite observations provide wide coverage of the ocean surface, especially Sea Surface Temperature (SST), but they do not directly provide a complete temperature profile below the surface.

Argo floats provide temperature and salinity measurements at different depths, but their observations are spatially and temporally sparse.

OceanEmbed aims to bridge this gap by combining both sources of information.

## Approach

The system combines:

- OISST surface temperature data
- Argo float profiles
- Spatial and temporal information
- Deep learning-based reconstruction
- GIS-based visualization

The data is cleaned, quality-checked and matched by location and time before being used for model development.

The reconstruction focuses on selected depths:

- 50 m
- 100 m
- 200 m
- 500 m

## Workflow

```text
OISST / Surface Observations
            |
            v
     Data Cleaning & QC
            |
            v
  Spatial-Temporal Data Fusion
            |
            v
    Argo Temperature Profiles
            |
            v
     Ocean Embedding Model
            |
            v
 Subsurface Temperature Profile
            |
            v
       GIS Visualization
```

## Data Sources

### OISST

NOAA's Optimum Interpolation Sea Surface Temperature (OISST) dataset is used as a major surface input.

OISST provides daily gridded sea surface temperature observations with broad spatial coverage. The data is handled in NetCDF format using Python and xarray.

### Argo

Argo provides in-situ measurements of ocean temperature and salinity at different depths.

For OceanEmbed, Argo temperature profiles act as the subsurface reference data. Individual profiles contain measurements at multiple pressure/depth levels.

## Data Processing

The main preprocessing steps are:

1. Load OISST and Argo data.
2. Perform quality checks.
3. Remove invalid or unusable observations.
4. Match observations using latitude and longitude.
5. Match observations across time.
6. Extract the required depth levels from Argo profiles.
7. Combine surface and subsurface information.
8. Prepare the model-ready dataset.

An important part of this process is spatial-temporal matching. An Argo profile collected at a particular location and time is paired with the corresponding surface SST information.

## Dataset Structure

The integrated dataset contains fields such as:

```text
LATITUDE
LONGITUDE
DATE
OISST_DATE_KEY
SST_SURFACE
PRES
TEMP
PSAL
```

| Column | Description |
|---|---|
| `LATITUDE` | Latitude of the observation |
| `LONGITUDE` | Longitude of the observation |
| `DATE` | Date/time of the Argo observation |
| `OISST_DATE_KEY` | Corresponding OISST date |
| `SST_SURFACE` | Surface sea temperature from OISST |
| `PRES` | Pressure/depth level of the Argo measurement |
| `TEMP` | Observed subsurface temperature |
| `PSAL` | Practical salinity |

## Ocean Embedding

Ocean Embedding refers to the learned representation created by the deep learning model.

The model learns relationships between surface temperature, location, time and subsurface observations. This representation is then used for subsurface temperature reconstruction.

```text
Surface Ocean Information
          |
          v
     Deep Learning
          |
          v
    Ocean Embedding
          |
          v
 Subsurface Temperature
```

## Model

The proposed model uses a deep learning approach suitable for spatial and temporal ocean data. **ConvLSTM** is considered as the main architecture.

ConvLSTM combines:

- **CNN** for learning spatial patterns
- **LSTM** for learning temporal patterns

General architecture:

```text
Surface Ocean Data
        |
        v
Spatial Features
        |
        v
Temporal Features
        |
        v
Ocean Embedding
        |
        v
Temperature Reconstruction
        |
        v
T50 | T100 | T200 | T500
```

The exact configuration can be adjusted according to the size and structure of the available training data.

## Subsurface Temperature Reconstruction

For a selected location, the system reconstructs temperature at selected depths.

```text
Surface
   |
   |---- 50 m
   |
   |---- 100 m
   |
   |---- 200 m
   |
   |---- 500 m
```

These values can be used to create a simplified vertical temperature profile.

## Anomaly Analysis

The project also includes anomaly analysis.

An anomaly represents a departure from a selected reference or expected condition.

```text
Reference / Observed Condition
             |
             v
       Model Result
             |
             v
      Temperature Anomaly
```

This helps highlight areas where estimated subsurface conditions differ from the reference data.

## GIS Visualization

GIS is used because ocean observations are strongly dependent on location.

The interface is designed to allow a user to select a location and use its latitude and longitude to query the model/data.

The visualization can include:

- Ocean surface conditions
- Observation locations
- Argo profiles
- Reconstructed subsurface temperature
- Temperature at different depths
- Anomaly information

Basic interaction:

```text
User selects location
        |
        v
Latitude + Longitude
        |
        v
Backend / Model
        |
        v
Subsurface Temperature
        |
        v
GIS Visualization
```

## Technology Stack

### Data Processing
- Python
- NumPy
- Pandas
- Xarray

### Data Formats
- NetCDF
- CSV

### Visualization / GIS
- Matplotlib
- QGIS
- Map-based visualization

### Machine Learning
- Deep Learning
- ConvLSTM

### Backend
- FastAPI / Flask

### Development
- VS Code
- Git / GitHub

## Project Structure

A simplified project structure can look like:

```text
OceanEmbed/
|
├── data/
│   ├── OISST/
│   ├── ARGO/
│   └── processed/
|
├── model/
│   ├── training/
│   ├── preprocessing/
│   └── prediction/
|
├── backend/
│   └── app.py
|
├── frontend/
│   ├── templates/
│   └── static/
|
├── notebooks/
│   └── EDA.ipynb
|
├── requirements.txt
|
└── README.md
```

The actual folder structure may change as development continues.

## Exploratory Data Analysis

EDA is used to understand the datasets before model training.

The analysis includes:

- Missing-value checks
- Temperature ranges
- Latitude and longitude coverage
- Argo profile distribution
- Surface and subsurface temperature comparison
- Spatial distributions
- Available dates
- Depth distribution of observations

This is particularly important because Argo observations are not uniformly distributed across space and time.

## Why Combine OISST and Argo?

The two datasets provide different types of information.

```text
             OISST
               |
       Broad surface coverage
               |
               v
          OceanEmbed
               ^
               |
              Argo
               |
       Subsurface observations
```

OISST provides a consistent surface view, while Argo provides direct measurements below the surface.

Together they provide:

**surface context + subsurface reference data**

## Expected Output

For a selected location, the system is designed to provide a subsurface temperature profile:

```text
Location:
Latitude: XX.XX
Longitude: XX.XX

Surface SST: XX.X °C

Depth       Temperature
-----------------------
50 m        XX.X °C
100 m       XX.X °C
200 m       XX.X °C
500 m       XX.X °C
```

The result can also be visualized on a map and as a depth-temperature profile.

## Current Prototype

The current prototype focuses on establishing the complete data pipeline:

```text
OISST + Argo
     |
     v
Data Processing
     |
     v
Spatial-Temporal Matching
     |
     v
Integrated Dataset
     |
     v
Model
     |
     v
Subsurface Temperature
     |
     v
GIS Visualization
```

Because ocean datasets are large, the prototype is designed to remain practical for development and demonstration on available computing resources.

## Applications

Potential applications include:

- Ocean monitoring
- Marine research
- Climate studies
- Ocean heat distribution analysis
- Marine ecosystem studies
- Oceanographic analysis
- GIS-based ocean exploration
- Research and education

OceanEmbed is intended as an analytical and research prototype, not as a replacement for operational ocean forecasting systems.

## Limitations

The current prototype has several practical limitations:

- Argo observations are spatially and temporally sparse.
- Available training data is smaller than the datasets used by operational ocean models.
- Surface observations do not directly contain complete subsurface information.
- Reconstruction accuracy can vary by location and depth.
- Large-scale training requires more computational resources.
- The prototype focuses on selected depths rather than the complete water column.

## Future Scope

Possible extensions include:

- Adding satellite-derived variables such as SSH, wind and chlorophyll.
- Increasing temporal coverage.
- Expanding the geographical region.
- Reconstructing more depth levels.
- Improving the deep learning architecture.
- Adding uncertainty estimation.
- Improving GIS interaction.
- Integrating additional oceanographic datasets.
- Extending the system towards short-term subsurface forecasting.

## Team

**Team Name:** The Analyzer

**SIH Problem Statement:** 26066

**Organization:** Ministry of Earth Sciences

**Project:** OceanEmbed

## References

### OISST
NOAA/NCEI Optimum Interpolation Sea Surface Temperature (OISST) dataset.

### Argo
Argo Global Ocean Observing System.

### GIS
QGIS – Open Source Geographic Information System.

### Research Background
The project draws from existing work in:

- Ocean subsurface temperature reconstruction
- Satellite-ocean data fusion
- Deep learning for oceanographic applications
- ConvLSTM-based spatiotemporal modelling

## Disclaimer

OceanEmbed is a research and hackathon prototype. Reconstructed subsurface temperatures are model estimates and should not be treated as direct measurements.

Actual accuracy depends on the quality, coverage and distribution of the input observations and the performance of the trained model.

---

> **OceanEmbed combines wide-coverage surface observations with sparse subsurface measurements to learn and visualize the hidden temperature structure of the ocean.**
