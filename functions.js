tools = {

    getEnv: function(name){
         return pm.environment.get(name);
    },
    setEnv: function(name,value){
        pm.environment.set(name, value);

    },
    verifyStatus: function (expectedStatusCode){
        var isCorrectResponseStatus = (pm.response.code == expectedStatusCode);
        var responseCode = pm.response.code

        pm.test(['Response status is ', responseCode].join(''), function () {
            pm.expect(responseCode).to.eql(expectedStatusCode);
        });
        
        if (!isCorrectResponseStatus)
        {
            tools.log(['Incorrect response status, should be ',expectedStatusCode,', but was ',responseCode]);
            pm.sendRequest(null);
            return false;
        }
        return true;
    },
     trimArray: function(currentArray,variableName){
        const tableToTrim = currentArray;
        for (var i = 0; i < tableToTrim.length; i++) {
            tableToTrim[i] = tableToTrim[i].replace(/\\s/g, "")      
            tools.setEnv(variableName,tableToTrim)      
            }
    },
    returnNestedValue: function(pathList, current){   
      
        var result = [];

        if (pathList == 0){
          
            return [current];
        }            

        var pathItem = pathList[0];
     
        pathList = pathList.slice(1);

        if (pathItem == '*' && Array.isArray(current)){
            current.forEach(function(item){
            
            result = result.concat(tools.returnNestedValue(pathList, item));
  
            });
        }
        else{
            result = result.concat(tools.returnNestedValue(pathList, current[pathItem]));
            
        }
        return result;
    },
    log: function(messageArray)
    {
        var executionId =  pm.response.headers.get('Execution-Id');
        var message= messageArray.join('');

        console.log([
            "Message: "+ message, 
            "Request : " + request.method + ": " + request.name + " ( "+ request.url +" )",
            "Bank: " + tools.getEnv('bankId_swiftbic'),
            "ExecutionId: " + executionId,
            "UserId: " + tools.getEnv('userId_clientId'),
            "SessionId: " + tools.getEnv('sessionId'),
            "ConsentId: " + tools.getEnv('consentId'),
            "Response status: " + pm.response.status,
        ].join("\\n"));
    },

    retryRequest: function (expectedValue, maxRetry, path) {
        if(path){
            var responseValue = tools.returnFieldsArray(path)[0];
        }   
        else{
            var responseValue = pm.response.code;
        }   
        if( !pm.environment.has('counter')){
            tools.setEnv('counter',0);
        }
        var counter = tools.getEnv('counter')
        if(counter < maxRetry && expectedValue !== responseValue){
            setTimeout(function(){},8000);
            postman.setNextRequest(request.name);
            console.log('counter = ' + counter);
            console.log("Response value is: " + responseValue);
            tools.setEnv('counter', counter + 1);
        }
        else if (counter >= maxRetry && expectedValue !== responseValue){
            postman.setNextRequest(null);
            tools.log(['Max retry limit has been exceeded. Flow ends.']);
            pm.environment.unset('counter');
            pm.test('Limit exceeded ', function () { throw new Error() });
        }
        else{
            tools.setEnv('counter', 0);
            return true;
        }
    },
    verifyArray: function(path, requiredType, expectedSize){
        var fields = tools.returnFieldsArray(path)
        var responseSize = fields.length;

        pm.test(['Verify size of array ', responseSize, ' = ',expectedSize].join(), function () {
            pm.expect(responseSize).to.eql(expectedSize)
        });
        tools.verifyField(path,true,{type:requiredType});
    },
    compareArrays: function(path, expectedArray,array){
        if(path)
            var current = tools.returnFieldsArray(path);
        else {var current = array}
        current.sort();
        expectedArray.sort();
        var results = _.isEqual(current, expectedArray);

        pm.test(['Two arrays are the same: ', results, ' |', ' Expected array: ', '[',expectedArray,']', ' Current array: ', '[',current,']'].join(''), function () {
                pm.expect(results).to.be.true;
            });
        
        if (results == false){
            tools.log(['Arrays are different']);
        }  
    },
    returnFieldsArray: function(path,innerPath){
        var pathList = [path];
        if (path.includes('.'))
            pathList = path.split('.');
        var fields = tools.returnNestedValue(pathList, pm.response.json());
        if (innerPath)
            {
                innerFields = [];
                fields.forEach(function(field) {
                    var fieldParsed = JSON.parse(unescape(field));
                    var pathList = [innerPath];
                    if (innerPath.includes('.'))
                        pathList = innerPath.split('.');
                        innerFields = innerFields.concat(tools.returnNestedValue(pathList,fieldParsed));
                });
                fields = innerFields;
            }
        return fields;
    },
    verifyFieldValue: function (fieldValue, requiredValue){
        pm.test('Verify if value: ' + fieldValue + ' is equeal to: ' + requiredValue, function () {
            pm.expect(fieldValue).to.eql(requiredValue)});
    },
    setGetVariableList: function(mode,inputList,target){
        if (mode == 'normal'){
            var list = tools.getEnv(inputList)
            var value = list.pop()
            pm.environment.set(target,value );
            console.log('Target: ' + target + ': ' + value);
            tools.setEnv(inputList,list);
        }
        else if(mode == 'accounts'){
            var list = tools.getEnv('accountsList');
            var len = tools.getEnv('accountsList').length;
            var counter = tools.getEnv('counter');
            if (counter < len) {
                postman.setEnvironmentVariable("accountId", list[counter]);
                counter++;
                pm.environment.set("counter", counter);
                }  
        else if(mode == 'queue'){
            var list = tools.getEnv('queueList')
            } 
        }
    },
    error: function(messageList, shouldBreak)
    {
        tools.log(messageList);
        if (shouldBreak)
        {
            postman.setNextRequest(null);
        }
        return false;
    },
    verifyField: function(path, isRequired, expected,innerPath) {  
        var fields = tools.returnFieldsArray(path,innerPath);
        var requiredType = expected.type;
        var requiredValue = expected.value;
        if(isRequired && fields.length == 0){
            pm.test('Field ' + path + ' is required and it is not present', function () { throw new Error() });
        }
        fields.forEach(function(fieldValue){
            var fieldType = typeof fieldValue;
            if (isRequired && requiredType &&  fieldType !== requiredType || !isRequired && requiredType != fieldType && fieldValue !== null)
            {
                pm.test('Type is incorrect. It should be: '+ requiredType + ' but it is: ' + fieldType, function () { throw new Error() });
                return tools.error(["Incorrect  type of field: ", path], true);
            }
            if (isRequired && typeof fieldValue == undefined){
                pm.test('Field '+ path + ' is required and is not provided' , function () { throw new Error() });
                return tools.error(["Missing required field: ", path], true);
            }
            if (requiredValue &&  fieldValue !== requiredValue)
            {
                pm.test('Value is incorrect. It should be: '+ requiredValue + ' but it is: ' + fieldValue, function () { throw new Error() });
                return tools.error(["Incorrect value of field: ", path], true);
            }
            if(requiredValue &&  fieldValue == requiredValue)
            {
                pm.test('Value is correct. It should be: '+ requiredValue + ' and it is: ' + fieldValue, function () { 
                    pm.expect(fieldValue).to.eql(requiredValue)
                    return true;
                 });
            }
            // if(requiredType && fieldType == requiredType)
            // {
            //     pm.test('Type is correct. It should be: '+ requiredType + ' and it is: ' + fieldType, function () { 
            //         pm.expect(fieldType).to.eql(requiredType)});
            // }
           
            
        })
    },
    retryRequest2: function(stopCondition,maxRetry) {
        var responseBody = pm.response.json();
        if( !pm.environment.has('counter')){
            tools.setEnv('counter',0);
        }
        var counter = tools.getEnv('counter')
        if(counter < maxRetry && !stopCondition(responseBody)){
            setTimeout(function(){},8000);
            postman.setNextRequest(request.name);
            console.log('counter = ' + counter);
            tools.setEnv('counter', counter + 1);
        }
        else if (counter >= maxRetry && !stopCondition(responseBody)){
            postman.setNextRequest(null);
            tools.log(['Max retry limit has been exceeded. Flow ends.']);
            pm.environment.unset('counter');
            pm.test('Limit exceeded ', function () { throw new Error() });
        }
        else{
            tools.setEnv('counter', 0);
            return true;
        }

    },
    isEmpty: function(empty){
        return  Object.keys(empty).length === 0 && empty.constructor === Object;
    },
    hasItem: function(list, type){
        switch (type)
        {
            case 'empty':
            console.log('empty')
                return list.some(tools.isEmpty);
		    case 'ibans':
            console.log('ibans')
			    return list.some(function(item){return item.hasOwnProperty("ibans")});
		    case 'iban':
                console.log('iban')
			    return list.some(function(item){return item.hasOwnProperty("iban")});
        }
    },	
    transactionCounter: function(value){
        if( !pm.environment.has('transactionCounter_'+tools.getEnv('userId_clientId'))){
            tools.setEnv('transactionCounter_'+tools.getEnv('userId_clientId'),0);
        }
        var transactionCounter = tools.getEnv('transactionCounter_'+tools.getEnv('userId_clientId'));
        transactionCounter = transactionCounter + value;
        tools.setEnv('transactionCounter_'+tools.getEnv('userId_clientId'),transactionCounter)
    }
}


pm.environment.set('tools', tools);