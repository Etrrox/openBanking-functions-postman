To use functions put all of this into pre-request script
In every request you would like to use it it's needed to use:
var tools = pm.environment.get('tools');
eval(tools);

then you can use functions by tools.functionName()