# TODO: document config file

# General
There can be as many config files as you like.

## Datamodel
Every file is to be made up from different `PersistentConfig` entries.
The config consists of the following fields:

<!-- |-----|--------|---------| -->
|field|type|default|mandatory|information|
|-----|-----|-----|-----|------|
|id|string| - | yes | Unique id for the `PersistentConfig`.|
|persistOnValueUpdate| boolean| `false` | no | `true`: Write a new value to influxdb for every value change. `false`: only write new values based on settings in `persistSchedules`.
|persistSchedules|array of strings| [] | no | List of 'cron' ([see here for more detail](https://crontab.guru/)) entries at which values are written to influxdb.|
|onlyOnChanged|boolean | `false` | no | `true`: Write a new value to influxdb only when the value changed. `false`: update the value to influxdb even if it did not change. (Note: this is only considered in combination with `persistOnValueUpdate`)
|properties| see [properties](#properties)| [] | no | List of queries/selectors to properties which should be persistet to influxdb based on this configuration.


## Properties
Properties can be selected/queried in the following manner:

- As a `PropertySelector`:
  
  A simple string specifying the property with mqtt topic notation. Only the part below the root topic is required.
  Format: `[deviceiD]/[nodeID]/[propertyID]` (e.g.: "tempsensor-kitchen/temphum/temperature")


- As a `PropertyDesignator`:
  
  Object defining the IDs for device, node and property in single fields:
  ```yaml
   - deviceId: tempsensor-kitchen
     nodeId: temphum
     propertyId: temperature
  ```


- As a `Query`: see [Query](#query)
  

## Query
A Query is a way to select multiple Properties at once based on the attributes of the Device, Node and Property itself.

A Query consists of 3 fields:
 - device
 - node
 - property

Each field can have the following values:
- `"*"`: will match any device/node/property
- `string`: will match the device/node/property with the matching ID
- `object`: with the following format:
  - ```yaml 
      "<<attributeName>>": value 
    ``` 
  - ```yaml
      "<<attributeName>>":
        operator: '=' | '>' | '<' | '>=' | '<=' | '<>' | 'includes' | 'includesAny' | 'includesAll' | 'includesNone' | 'matchAlways'
        value: value | value[]

    ```



## Example
```yaml

---
id: weather-logs
persistOnValueUpdate: true
persistSchedules:
  - "* * * * *"
properties:
  # Query all weather and thermostat nodes, log all properties with a celcius, percentage and pressure unit setting
  - device: "*"
    node: 
      id: 
        operator: =
        value: ["weather", "thermostat"]
    property: 
      unit:
        operator: =
        value: ["°C", "%", "kPa"]
      retained: true


---
id: battery-logs
persistOnValueUpdate: true
persistSchedules:
  - "* * * * *"
properties:
  # Query all battery-level properties under a maintenance node - this could also be part of the upper weather-logs config
  - device: "*"
    node: maintenance
    property: battery-level



```

