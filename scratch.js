const minMagnitude = 2.5;
const now = new Date();
const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
const params = new URLSearchParams({
  format: "geojson",
  starttime: thirtyDaysAgo.toISOString(),
  endtime: now.toISOString(),
  minmagnitude: minMagnitude.toString(),
  orderby: "time",
  limit: "20000",
});
const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`;
fetch(url).then(res => res.json()).then(data => {
  console.log("Success! Events:", data.features.length);
}).catch(err => console.error(err));
