var fs = require('fs');
var common = require('./common');
var pathUtils = require('path');
var Promise = require('bluebird');

var wrapper = {
		stat : Promise.promisify(fs.stat),
		lstat : Promise.promisify(fs.lstat),
		readdir : Promise.promisify(fs.readdir),
};

/**
 * Returns the sorted list of entries in a directory.
 */
var getEntries = function (path, options) {
    if (!path) {
    	return Promise.resolve([]);
    } else{
    	return wrapper.stat(path).then(
				function(stat){
	    			if(stat.isDirectory()){
	    				return wrapper.readdir(path).then(
								function(rawEntries){
									return buildEntries(path, rawEntries, options);
								});
	    			} else{
	    		        var name = pathUtils.basename(path);
	    		        return [
	           		            {
	        		                name : name,
	        		                path : path,
	        		                stat : stat
	        		            }
	        		        ];
	    			}
				});
    }
}

var buildEntries = function(path, rawEntries, options){
	var promisedEntries = [];
    rawEntries.forEach(function (entryName) {
    	promisedEntries.push(buildEntry(path, entryName));
    });
    return Promise.all(promisedEntries).then(
			function(entries){
    	        var result = [];
        		entries.forEach(function(entry){

                    if (common.filterEntry(entry, options)){
                        result.push(entry);
                    }
        		});
        		return options.ignoreCase?result.sort(common.compareEntryIgnoreCase):result.sort(common.compareEntryCaseSensitive);
			});
}

var buildEntry = function(path, entryName){
    var entryPath = path + '/' + entryName;
	return Promise.all([wrapper.stat(entryPath), wrapper.lstat(entryPath)])
		.then(
				function(result){
				    var stat = result[0];
				    var lstat = result[1];
				    return {
				            name : entryName,
				            path : entryPath,
				            stat : stat,
				            symlink : lstat.isSymbolicLink(),
				            toString : function () {
				                return this.name;
				            }
				        };
				});
}


/**
 * Compares two directories asynchronously.
 */
var compare = function (path1, path2, level, relativePath, options, compareFileCallback, resultBuilderCallback, res, diffSet) {
	return Promise.all([getEntries(path1, options), getEntries(path2, options)]).then(
			function(entriesResult){
				var entries1 = entriesResult[0];
			    var entries2 = entriesResult[1];
			    var i1 = 0, i2 = 0;
			    var comparePromises = [];
			    while (i1 < entries1.length || i2 < entries2.length) {
			        var entry1 = entries1[i1];
			        var entry2 = entries2[i2];
			        var n1 = entry1 ? entry1.name : undefined;
			        var n2 = entry2 ? entry2.name : undefined;
			        var p1 = entry1 ? entry1.path : undefined;
			        var p2 = entry2 ? entry2.path : undefined;
			        var fileStat1 = entry1 ? entry1.stat : undefined;
			        var fileStat2 = entry2 ? entry2.stat : undefined;
			        var type1, type2;

			        // compare entry name (-1, 0, 1)
			        var cmp;
			        if (i1 < entries1.length && i2 < entries2.length) {
			            cmp = options.ignoreCase?common.compareEntryIgnoreCase(entry1, entry2):common.compareEntryCaseSensitive(entry1, entry2);
			            type1 = common.getType(fileStat1);
			            type2 = common.getType(fileStat2);
			        } else if (i1 < entries1.length) {
			            type1 = common.getType(fileStat1);
			            type2 = common.getType(undefined);
			            cmp = -1;
			        } else {
			            type1 = common.getType(undefined);
			            type2 = common.getType(fileStat2);
			            cmp = 1;
			        }

			        // process entry
			        if (cmp == 0) {
			            if (type1 === type2) {
			                var same;
			                if(type1==='file'){
			                    same = compareFileCallback(p1, fileStat1, p2, fileStat2, options);
			                } else{
			                    same = true;
			                }
			                appendEntry(entry1, entry2, same ? 'equal' : 'distinct', level, relativePath, options, diffSet);
			                same ? res.equal++ : res.distinct++;
			            } else {
			            	appendEntry(entry1, entry2, 'distinct', level, relativePath, options, diffSet);
			                res.distinct++;
			            }
			            i1++;
			            i2++;
			            if(!options.skipSubdirs){
			                if (type1 == 'directory' && type2 === 'directory') {
			                	var subDiffSet = [];
			                	diffSet.push(subDiffSet);
			                	comparePromises.push(compare(p1, p2, level + 1,
			                			relativePath + '/' + entry1.name,
			                			options, compareFileCallback,
			                			resultBuilderCallback, res, subDiffSet));
			                } else if (type1 === 'directory') {
			                	var subDiffSet = [];
			                	diffSet.push(subDiffSet);
			                	comparePromises.push(compare(p1, undefined,
			                			level + 1, relativePath + '/'
			                			+ entry1.name, options,
			                			compareFileCallback,
			                			resultBuilderCallback, res, subDiffSet));
			                } else if (type2 === 'directory') {
			                	var subDiffSet = [];
			                	diffSet.push(subDiffSet);
			                	comparePromises.push(compare(undefined, p2,
			                			level + 1, relativePath + '/'
			                			+ entry2.name, options,
			                			compareFileCallback,
			                			resultBuilderCallback, res, subDiffSet));
			                }
			            }
			        } else if (cmp < 0) {
			        	appendEntry(entry1, undefined, 'left', level, relativePath, options, diffSet);
			            res.left++;
			            i1++;
			            if (type1 == 'directory' && !options.skipSubdirs) {
		                	var subDiffSet = [];
		                	diffSet.push(subDiffSet);
			            	comparePromises.push(compare(p1, undefined,
			            			level + 1,
			            			relativePath + '/' + entry1.name, options,
			            			compareFileCallback, resultBuilderCallback,
			            			res, subDiffSet));
			            }
			        } else {
	                	var subDiffSet = [];
	                	diffSet.push(subDiffSet);
			        	appendEntry(undefined, entry2, 'right', level, relativePath, options, subDiffSet);
			            res.right++;
			            i2++;
			            if (type2 == 'directory' && !options.skipSubdirs) {
		                	var subDiffSet = [];
		                	diffSet.push(subDiffSet);
			            	comparePromises.push(compare(undefined, p2,
			            			level + 1,
			            			relativePath + '/' + entry2.name, options,
			            			compareFileCallback, resultBuilderCallback,
			            			res, subDiffSet));
			            }
			        }
			    }
			    return Promise.all(comparePromises);
			});
};

var appendEntry = function (entry1, entry2, state, level, relativePath, options, diffSet) {
	if(diffSet===undefined) debugger
    diffSet.push({
    	entry1:entry1,
    	entry2:entry2,
    	state:state,
    	level:level,
    	relativePath:relativePath,
    	options:options
    });
}

module.exports = compare;