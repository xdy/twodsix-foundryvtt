//Success is not 0 to avoid falsiness.
var Crit;
(function (Crit) {
  Crit[Crit["neither"] = 0] = "neither";
  Crit[Crit["success"] = 1] = "success";
  Crit[Crit["fail"] = 2] = "fail";
})(Crit || (Crit = {}));
export default Crit;
