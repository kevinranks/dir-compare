var colors = require('colors');
var util = require('util');

var tab = function (tabs) {
    var res = '';
    while (tabs>=0) {
        res += ' ';
        tabs--;
    }
    return res;
};

// Prints dir compare results.
// 'program' represents display options and correspond to dircompare command line parameters.
// Example: 'dircompare --show-all --exclude *.js dir1 dir2' translates into 
// program: {showAll: true, exclude: '*.js'}
// 
var print = function(res, writer, program){
    var nocolor = function(str){return str};
    var cequal = program.nocolors?nocolor:colors.green;
    var cdistinct = program.nocolors?nocolor:colors.red;
    var cleft = program.nocolors?nocolor:colors.cyan;
    var cright = program.nocolors?nocolor:colors.magenta;
    var cdir = program.nocolors?nocolor:colors.gray;

    // calculate relative path length for pretty print
    var relativePathMaxLength = 0, fileNameMaxLength=0;
    if(!program.csv){
        res.diffSet.forEach(function (detail) {
            if(detail.relativePath.length>relativePathMaxLength){
                relativePathMaxLength = detail.relativePath.length;
            }
            var len = getCompareFile(detail, '??').length;
            if(len>fileNameMaxLength){
                fileNameMaxLength = len;
            }
        });
    }

    // csv header
    if(program.csv){
        writer.write('path,name,state,type,size1,size2,date1,date2\n');
    }
    var statTotal=0, statEqual=0, statLeft=0, statRight=0, statDistinct=0;

    for(var i = 0; i<res.diffSet.length; i++){
        var detail = res.diffSet[i];
        var color, show = true;

        if(!program.wholeReport){
            // show only files
            var type = detail.type1!=='missing'?detail.type1:detail.type2;
            if(type!=='file'){
                show = false;
            }
        }
        if(show){
            switch (detail.state) {
            case 'equal':
                color = cequal;
                show = program.showAll || program.showEqual?true:false;
                statTotal++;
                statEqual++;
                break;
            case 'left':
                color = cleft;
                show = program.showAll || program.showLeft?true:false; 
                statTotal++;
                statLeft++;
                break;
            case 'right':
                color = cright;
                show = program.showAll || program.showRight?true:false; 
                statTotal++;
                statRight++;
                break;
            case 'distinct':
                color = cdistinct;
                show = program.showAll || program.showDistinct?true:false; 
                statTotal++;
                statDistinct++;
                break;
            default:
                show = true;
            color = colors.gray;
            }
            if(show){
                if(program.csv){
                    printCsv(writer, detail, color);
                } else {
                    printPretty(writer, program, detail, color, cdir, relativePathMaxLength, fileNameMaxLength);
                }
            }
        }
    }

    // PRINT STATISTICS
    writer.write(res.same?cequal('Entries are identical\n'):cdistinct('Entries are different\n'));
    writer.write(util.format('total: %s, equal: %s, distinct: %s, only left: %s, only right: %s\n',
            statTotal,
            cequal(statEqual),
            cdistinct(statDistinct),
            cleft(statLeft),
            cright(statRight)
    ));
}

/**
 * Print details for default view mode
 */
var printPretty = function(writer, program, detail, color, dircolor, relativePathMaxLength, fileNameMaxLength){
    var path = detail.relativePath===''?'/':detail.relativePath;

    var state;
    switch (detail.state) {
    case 'equal':
        state = '==';
        break;
    case 'left':
        state = '->';
        break;
    case 'right':
        state = '<-';
        break;
    case 'distinct':
        state = '<>';
        break;
    default:
        state = '?';
    }
    var spacePad = relativePathMaxLength - path.length;
    var type ='';
    type = detail.type1!=='missing' ? detail.type1 : detail.type2;
    if(type==='directory'){
        type = dircolor(type);
    }
    var cmpentrylen = getCompareFile(detail, "??").length;
    var cmpentry = getCompareFile(detail, color(state));
    if(program.wholeReport){
        writer.write(util.format('[%s] %s(%s)\n', path, cmpentry, type));
    } else{
        writer.write(util.format('[%s] %s\n', path, cmpentry));
    }
}

var getCompareFile = function(detail, state){
    p1 = detail.name1 ? detail.name1 : '';
    p2 = detail.name2 ? detail.name2 : '';
    var missing1 = detail.type1==='missing' ? 'missing' : '';
    var missing2 = detail.type2==='missing' ? 'missing' : '';
    return util.format('%s%s%s%s%s', missing1, p1, state, missing2, p2);
}

/**
 * Print csv details.
 */
var printCsv = function(writer, detail, color){
    var size1='', size2='';
    if(detail.type1==='file'){
        size1 = detail.size1!=undefined ? detail.size1 : '';
    }
    if(detail.type2==='file'){
        size2 = detail.size2!=undefined ? detail.size2 : '';
    }

    var date1='', date2='';
    date1 = detail.date1!=undefined ? detail.date1.toISOString() : '';
    date2 = detail.date2!=undefined ? detail.date2.toISOString() : '';

    var type ='';
    type = detail.type1!=='missing' ? detail.type1 : detail.type2;

    var path = detail.relativePath?detail.relativePath:'/';
    var name = (detail.name1?detail.name1:detail.name2);

    writer.write(util.format('%s,%s,%s,%s,%s,%s,%s,%s\n', path, name, color(detail.state), type, size1, size2, date1, date2));
};

module.exports = print;