# iRail GTFS-RT to Linked Connections

Converts the GTFS-RT to Linked Connections and adds this to our knowledge graph at _todo_

## Use

Clone this repo and run `npm install`

Running `./bin/gtfsrt2lc.js --help` will provide you with all flags that are currently supported.

## Example usage

Let's say we want each minute to update our Linked Connections mongodb instance updated with realtime data, then we can do something like this in a crontab (`crontab -e`):

```crontab
* * * * * /home/username/gtfsrt2lc/bin/gtfsrt2lc.js http://gtfs.irail.be/nmbs/trip_updates.pb -f mongo | mongoimport -d irail -c connections --upsert
```
