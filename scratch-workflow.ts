import { runSeismicAnalysis } from "./bot/src/analysis/workflow";

runSeismicAnalysis().then((res) => {
  console.log("Success:", JSON.stringify(res, null, 2));
}).catch(err => {
  console.error("Failed:", err);
});
