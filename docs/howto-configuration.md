# TODO: document config file

# General
There can be as many config files as you like.

## Datamodel
```typescript
export type PersistenceConfigs = PersistenceConfig[];

export type PropertySel = PropertySelector | Query;

export interface PersistenceConfig {
    /** ID of persistence config */
    id: string;
    /** cron expressions for scheduled persistence e.g. every hour */
    persistSchedules?: string[];
    /** Persist whenever a value is received */
    persistOnValueUpdate?: boolean;
    /** Persist only when the value changed */
    onlyOnChanged?: boolean;
    /** List of properties that should be persisted */
    properties: PropertySel[];
}
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