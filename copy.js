var fs = require('fs');
var path = require('path');
var mkdirSync = require('mkdirp').sync;

function convertPath(dir){
    if (process.platform == 'win32' && dir[0] == '/')
        dir = dir.replace(/(?:\/cygdrive)?\/(\w)\//, '$1:/');
    return dir;
}

function copyBinaryFile(srcFile, destFile) {
    var BUF_LENGTH = 64*1024;
    var buf = new Buffer(BUF_LENGTH);
    var bytesRead = BUF_LENGTH;
    var pos = 0;
    var fdr = fs.openSync(srcFile, 'r');
    var fdw = fs.openSync(destFile, 'w');

    while (bytesRead === BUF_LENGTH) {
        bytesRead = fs.readSync(fdr, buf, 0, BUF_LENGTH, pos);
        fs.writeSync(fdw, buf, 0, bytesRead);
        pos += bytesRead;
    }

    fs.closeSync(fdr);
    fs.closeSync(fdw);
}

function copy(from, to, options) {
    from = convertPath(from);
    to = convertPath(to);
    if (!options) options = {};
    var exclude = options.exclude;
    var include = options.include;
    
    function filterCopyDir(from, to) {
        var files = fs.readdirSync(from);
        var dirCreated = false;
        files.forEach(function(x) {
            if ((exclude && exclude.test(x)) && !(include && include.test(x))) 
                return;
            var stat; try {
                stat = fs.lstatSync(from  + '/' + x);
            } catch(e) {
                return console.error(e);
            }
            
            if (!dirCreated) {
                if (options.onDir && options.onDir(from, to) === false)
                    return;
                if (options.shallow)
                    return;
                try {
                    fs.mkdirSync(to);
                } catch (e) {
                    return; //console.error(e);
                }
                dirCreated = true;
            }
            
            if (stat.isSymbolicLink())
                return;
            if (stat.isDirectory()) {
                filterCopyDir(from + '/' + x, to + '/' + x);
            } else {
                try {
                    copy.file(from+ '/' + x, to+ '/' + x, options.replace);
                } catch(e) {
                    console.error(e);
                }
            }
        });
    }
    filterCopyDir(from, to);
}
copy.dirs = function(from, to, dirs, options) {
    dirs.forEach(function(d) {
        copy(from + "/" + d, to + "/" + d, options);
    });
};
copy.file = function(from, to, replace) {
    from = convertPath(from);
    to = convertPath(to);
    
    if (replace) {
        var data = fs.readFileSync(from, "utf8");
        if (Array.isArray(replace))
            data = replace.reduce(function(a, f) {return f(a)}, data);
        else if (replace)
            data = replace(data);
    }
    
    function write() {
        if (replace)
            fs.writeFileSync(to, data, "utf8");
        else
            copyBinaryFile(from, to);
    }
    try {
        write();
    } catch(e) {
        if (e.code == "ENOENT") {
            mkdirSync(path.dirname(to));
            write();
        } else {
            throw e;
        }
    }
        
};

module.exports = copy;

