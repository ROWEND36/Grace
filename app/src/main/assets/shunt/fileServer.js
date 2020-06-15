fs = require("fs");
path= require("path");
overwrite = {flags:"w"}
safewrite = {flags:"wx"}
exports.getFileList = function(res,rootFile){
    fs.readdir(rootFile,function(err,files){
        if(err){
            console.log(err);
            res.status(500);
            res.end("Error Listing Files");
            return;
        }
        files=files.map(function(file){
            if(fs.statSync(rootFile+"/"+file).isDirectory()){
                file+="/";
            }
            return file;
        });
        res.json(files);

        res.end();
    });
}

var copyFile  = exports.copyFile = function(from,to,root2,errors,allowOver,options,callback,counter){
    let base = path.basename(from);
    //console.log(base);
    let newFile = path.join(to,root2,base);
    //console.log("copying "+from+" to "+to+root2);
    var r  = fs.createReadStream(from);
    if(!r){
        let e = "unable to read"
        console.log(from+e.code);
        errors.push({from:from,to:to,root:root2,cause:e.code});
        return;
    }
    var ops = (allowOver|| options[from])?overwrite:safewrite;
    var w = fs.createWriteStream(newFile,ops);
    if(!w){
        let e = "unable to write"
        console.log(from+e.code);
        errors.push({from:from,to:to,root:root2,cause:e.code});
        return;
    }
    r.pipe(w);
    r.on('error',function(e){
        console.log(from+e.code);
        errors.push({from:from,to:to,root:root2,cause:e.code});
        counter.decrement();
    })
    counter.increment();
    w.on('error',function(e){
        console.log(from+e.code);
        errors.push({from:from,to:to,root:root2,cause:e.code});
        counter.decrement();
    });
    r.on('end',function(e){
        console.log('finished');
        counter.decrement();
    });
};

var copyFolder = exports.copyFolder = function(from,to,root2,errors,allowOver,options,callback,counter){
    if (counter === undefined) {
        counter = new Object();
        counter.callback=callback;
        counter.count=0;
        counter.increment=function(name){console.log(name);this.count++;};
        counter.decrement=function(name){this.count--;console.log(name);
                                     if(this.count===0&&this.callback)
                                         this.callback();};
    }
    counter.increment();
    let base = path.basename(from);
    //console.log(options[from]);
    //console.log(base);
    let newFolder = path.join(to,root2,base);
    //console.log("copying "+from+" to "+to);
    fs.mkdir(newFolder,function(e){
        if(e){
            if(!((e.code=='EEXIST')&&(allowOver||options[from]))){
                console.log(from+e.code);
                errors.push({from:from,to:to,root:root2,cause:e.code});
                counter.decrement();
                return;}
        }
        fs.readdir(from,function(e,r){
            if(e){
                console.log(from+e.code);
                errors.push({from:from,to:to,root:root2,cause:e.code});
                counter.decrement();
                return;
            }
            else{
                for(let i in r){
                    //console.log(from);
                    //console.log(r[i]);
                    //console.log(root2);

                    var stat = fs.statSync(from+"/"+r[i]);
                    var p = path.join(from,r[i]);
                    //console.log(p);
                    var y = path.join(root2,base);
                    //console.log(y);
                    if(stat.isDirectory()){
                        copyFolder(p+"/",to,y,errors,allowOver|| options[from]>1,options,callback,counter);
                    }
                    else if(stat.isFile()){
                        copyFile(p,to,y,errors,allowOver|| options[from]>1,options,callback,counter);
                    }
                    else{
                        console.log(from+e.code);
                        errors.push({from:p,to:to,root:root2,cause:e.code});
                        continue;
                    }
                }
                counter.decrement();
            }
        });
    })
}
exports.saveFile = function(body){
    fs.open(body.path, 'w', (err, fd) => {
        fs.writeSync(fd,body.text);
    });
}
var errors=[];
copyFolder("/storage/emulated/0/backups/apps/Codeanywhere_6.1.9/assets/","/sdcard/Alarms","",errors,false,
           {"/storage/emulated/0/backups/apps/Codeanywhere_6.1.9/assets/www/":1,
            "/storage/emulated/0/backups/apps/Codeanywhere_6.1.9/assets/":1,
            "/storage/emulated/0/backups/apps/Codeanywhere_6.1.9/assets/www/worker/":2,

           },function(){
    console.log(errors);});








