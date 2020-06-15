"use strict";
registerAll({
    'recentFolders': '',
    'root:file-browser': '/sdcard/',
    'root:hierarchy': '/sdcard/',
    'customBrowsers': '{}',
    'customServers': '{}',
    'hierarchyfileServer': '',
    'bookmarks': '["/sdcard/", "/data/data/io.tempage.dorynode/"]',
});
var sort_mode = "folder,code,name";
var selected = null;
var file_colors = {
    'html': 'orange',
    'js': 'green',
    'css': 'lighten-2 blue',
    'sass': 'pink',
    'less': 'pink'
};
var show_hidden = false;
var copiedPath = null;
var mode = 0; //copy
var recentFolders = []
var _server = "http://localhost:3000";
var _fileBrowsers = {
    push: function(browserObj) {
        _fileBrowsers[browserObj.id] = browserObj;
    }
};
var loadedServers = {}
var customBrowsers = JSON.parse(appConfig.customBrowsers);
var customServers = JSON.parse(appConfig.customServers);
var bookmarks = JSON.parse(appConfig.bookmarks)
if (appConfig.recentFolders)
    recentFolders = appConfig.recentFolders.split(",");

function test(a, b, next, i) {
    var testfunc = sort_funcs[next[i]];
    if (testfunc(a, b)) {
        return -1;
    }
    else if (testfunc(b, a)) {
        return 1;
    }
    if (next[i + 1] === undefined)
        return 0;
    else
        return test(a, b, next, i + 1);
}
function genId(type){
    return type + new Date().getTime();
}
var sortlist;
var sort_funcs = {
    folder: function(a, b) {
        return a.endsWith("/") && !(b.endsWith("/"));
    },
    code: function(a, b) {
        //todo use code file for b
        return isCode(a) && !isCode(b);
    },
    name: function(a, b) {
        return b.toLowerCase() > a.toLowerCase();
    }

}
const code_files = [".js", ".css", ".html", ".sass", ".less", ".json", ".py"]
const non_code_files = [".zip", ".tar.gz", ".rar"]
var isCode = function(a) {
    for (var i in code_files) {
        if (a.endsWith(code_files[i]))
            return true;
    }
    return false;
}

function sort(files, mode) {
    var modes = mode.split(",");
    return files.sort(function(a, b) {
        return test(a, b, modes, 0);
    });
}

function getBookMarks() {
    return bookmarks;
}

function AppFileServer(path) {
    if (!path) path = "/sdcard/"
    const app = Application;
    this.getFile = function(path, callback) {
        try {
            var res = app.getFile(path);
            if (callback)
                setTimeout(function() {
                    callback(res);
                }, 0);
        }
        catch (err) {
            console.error(err)
            /*if (callback)
                setTimeout(function() {
                    callback(res);
                }, 0);*/
        }

    }
    this.getFiles = function(path, callback) {
        try {
            var res = app.getFiles(path);
            if (callback)
                setTimeout(function() {
                    callback(JSON.parse(res));
                }, 0);
        }
        catch (err) {
            console.error(err)
        }
    }
    this.saveFile = function(path, content, callback) {
        try {
            var res = app.saveFile(path, content);
            if (callback)
                setTimeout(function() {
                    callback(res);
                }, 0);
        }
        catch (err) {
            console.error(err)
        }
    }
    this.copyFile = function(path, dest, overwrite, callback) {
        try {
            var res = app.copyFile(path, dest, overwrite);
            if (callback)
                setTimeout(function() {
                    callback(res);
                }, 0);
        }
        catch (err) {
            console.error(err)
        }
    }
    this.newFolder = function(path, callback) {
        try {
            var res = app.newFolder(path);
            if (callback)
                setTimeout(function() {
                    callback(res);
                }, 0);
        }
        catch (err) {
            console.error(err)
        }
    }
    this.rename = function(path, dest, callback) {
        try {
            var res = app.rename(path, dest);
            if (callback)
                setTimeout(function() {
                    callback(res);
                }, 0);
        }
        catch (err) {
            console.error(err)
        }
    }
    this.delete = function(path, callback) {
        try {
            var res = app.delete(path);
            if (callback)
                setTimeout(function() {
                    callback(res);
                }, 0);
        }
        catch (err) {
            console.error(err)
        }
    }
    this.move = function(path, dest, callback) {
        try {
            var res = app.move(path, dest);
            if (callback)
                setTimeout(function() {
                    callback(res);
                }, 0);
        }
        catch (err) {
            console.error(err)
        }
    }
    this.getRoot = function() {
        return path;
    }

}

function RESTFileServer(address, rootDir) {
    var server = address;
    if (!rootDir) rootDir = "/";
    this.getFile = function(path, callback) {
        $.get(server + "/open?file=" + path, callback);
    }
    this.getFiles = function(path, callback) {
        $.getJSON(server + "/files?dir=" + path, callback);
    }
    this.saveFile = function(path, content, callback) {
        $.post(server + "/save", {
            path: path,
            text: content
        }, callback);
    }
    this.copyFile = function(path, dest, overrite, callback) {
        $.post(server + "/copy", {
            path: path,
            dest: dest
        }, callback);
    }
    this.newFolder = function(path, callback) {
        $.post(server + "/new", {
            path: path,
        }, callback);
    }
    this.delete = function(path, callback) {
        $.post(server + "/delete", {
            path: path,
        }, callback);
    }
    this.rename = function(path, dest, callback) {
        $.post(server + "/rename", {
            path: path,
            dest: dest
        }, callback);
    }
    this.move = function(path, dest, overrite, callback) {
        $.post(server + "/copy", {
            path: path,
            dest: dest
        }, callback);
    }
    this.getRoot = function() {
        return rootDir;
    }
}

function FindFileServer(fileServer) {
    var filter = "";
    var b = fileServer;
    this.__proto__ = fileServer;
    this.setFilter = function(glob) {
        filter = glob;
    }
    this.getFiles = function(path, callback) {
        b.getFiles(path, function(res) {
            var filtered = []
            for (var i of res) {
                if (i.endsWith("/")) {
                    filtered.push(i)
                }
                else if (i.match(filter)) {
                    //todo match folders
                    filtered.push(i);
                }
            }
            if (callback)
                callback(filtered)
        })
    }

}
if (window.Application)
    var _fileServer = new AppFileServer();
else
    var _fileServer = new RESTFileServer(_server, '/sdcard/');


function FileBrowser(id, rootDir, fileServer, noReload) {
    var stub;
    this.fileServer = fileServer;
    //the html element of the fileview
    this.stub = null;
    //the fixed header
    this.header = null;
    //the scrollable element
    this.root = null;
    //the current directory
    this.rootDir = null;
    //list of items
    this.hier = null;
    //whether to use single page with back-button
    this.folderDropdown = "folder-dropdown";
    this.fileDropdown = "file-dropdown"
    //Create server
    if (!this.fileServer) {
        console.log("null fileServer")
        this.fileServer = _fileServer;
    }
    //Create stub
    if (typeof id === 'object') {
        stub = id;
        id = undefined;
    }
    else
        stub = $("#" + id);
    if (stub.length < 1) {
        console.error("Bad id or selector")
        throw "Error";
    }
    this.stub = stub;

    if (rootDir && rootDir.indexOf(this.fileServer.getRoot()) > -1) {
        this.rootDir = rootDir;
    }
    else if (id && appConfig["root:" + id]) {
        this.rootDir = appConfig["root:" + id];
    }
    else {
        this.rootDir = this.fileServer.getRoot();
    }
    this.id = id;

    this.setRootDir = (dir) => {
        this.rootDir = dir;
        if (this.id) {
            configure("root:" + this.id, dir);
        }
    }
    this.setRootDir(this.rootDir)
    const self = this;
    if (stub.length)
        this.createView(stub);
    if (this.hier)
        this.updateHierarchy(this.hier)
    else if (noReload) {}
    else
        this.reload();

}
FileBrowser.prototype.createHeader = function() {
    this.stub.append("<div class=\"fileview-header\"></div>")
    this.header = this.stub.children().last();
    this.updateHeader();
}
FileBrowser.prototype.getTopEl = function() {
    return "<li filename=\"..\" class='file-item back-button collection-item '><span><i class = 'green-text material-icons'>reply</i></span><span class='filename'>" + ".." +
        "</span>" +
        "</li>"
}
FileBrowser.prototype.inflateChildren = function(children, element, topEl) {

    if (children.length < 1)
        element.append('<li class="flow-text center ">Empty</li>');

    var color;
    if (topEl)
        element.append(topEl);

    for (let child in children) {
        if (this.hier && this.hier.indexOf(children[child]) < 0)
            color = "emphasis scroll-point"
        else
            color = "";
        if (children[child] == this.selectFile)
            color += " selectFile"
        if (!show_hidden && children[child][0] == ".") {
            continue;
        }
        if (children[child][children[child].length - 1] == '/')
            element.append(
                "<li filename=\"" + children[child] + "\" class='folder-item file-item collection-item '" + color + "><span><i class =  'material-icons'>folder</i></span><span class='filename'>" + children[child].slice(0, children[child].length - 1) +
                "</span><span class=\"dropdown-btn right\" data-target=\"" + this.folderDropdown + "\">" +
                "<i class=\"material-icons\" >more_vert</i>" +
                "</span></li>"
            );
        else
            element.append(
                "<li filename=\"" + children[child] + "\" class='file-item collection-item  lighten-2 " + color + "'><span ><i class='material-icons " + file_colors[children[child].slice(children[child].lastIndexOf(".") + 1)] + "-text' >insert_drive_file</i></span><span class='filename'>" + children[child] +
                "</span><span class=\"dropdown-btn right\" data-target=\"" + this.fileDropdown + "\">" +
                "<i class=\"material-icons\" >more_vert</i>" +
                "</span></li>"

            );
    }

};
FileBrowser.prototype.onBackPressed = function() {
    var self = this;
    var e = function() {
        var lastDir = self.rootDir;
        self.setRootDir(self.parent(self.rootDir));
        self.reload();
        if (self.rootDir + self.filename(lastDir) == lastDir)
            self.updateHierarchy([self.filename(lastDir)])
    }
    return e;
}
FileBrowser.prototype.onFolderClicked = function() {
    var self = this;
    var e = function(f) {
        self.setRootDir(self.rootDir + this.getAttribute("filename"));
        self.reload();
    }
    return e;
};

function linkify(path) {
    var paths = path.split("/")
    var address = "";
    var el = "";
    for (var i = 0; i < paths.length - 2; i++) {
        address += paths[i] + "/";
        el += "<a href='#' data-target=" + address + " >" + paths[i] + "/" + "</a>";
    }
    el += "<span>" + paths[i] + "</span>";
    return el;
}
FileBrowser.prototype.updateHeader = function() {
    const self = this;
    if (!this.header) {
        this.createHeader();
        return;
    }
    this.header.empty();
    this.header.append(
        '<div id="filedir-select" class="edge_box-2">' +
        '<span class="fill_box clipper">' +
        linkify(self.rootDir) +
        '</span>' +
        '<select class="side-1">' +

        //"<b style='/*position:absolute;left:50px;right:50px;overflow:scroll*/'>" + this.rootDir + "</b>" +
        "</select>" +
        "<span class='side-2 create center'><i class='material-icons'>more_vert</i></span>" +
        "</div>"

    );
    var select = this.header.find("select")
    var e;
    var options = []


    for (e of recentFolders)
        if (options.indexOf(e) < 0)
            options.push(e);
    for (e of getBookMarks())
        if (options.indexOf(e) < 0)
            options.push(e);

    for (e of options)
        select.append("<option></option>").children().last().attr("value", e).attr("filename", e).text(e)

    select.on("change", function(e) {
        if (e.target.value.indexOf(self.fileServer.getRoot()) > -1) {
            self.setRootDir(e.target.value);
            self.reload();
        }
        else {
            e.target.value = self.rootDir;
        }
    });
    select.val(self.rootDir)
    select.addClass("number")
    this.header.find(".create").click(function(e) {
        self.showCtxMenu("create-dropdown", $(this)[0]);
        e.stopPropagation();
    });
    this.header.find(".fill_box a").click(function(e) {
        self.setRootDir(e.target.getAttribute("data-target"));
        self.reload();
    })
    this.stub.css("padding-top", "50px");
};
FileBrowser.prototype.rename = function(a, b) {
    var former = a.attr('filename');
    if (former.endsWith("/"))
        b += "/";
    var path = this.rootDir + a.attr('filename');
    var dest = this.rootDir + b;
    if (dest == path)
        return;
    var self = this;
    if (this.hier.indexOf(b) > -1)
        throw "File Already Exists";
    if (Doc.forPath(dest)) {
        Doc.swapDoc(Doc.forPath(dest).id)
        throw "File Already Exists in Tabs";
    }
    this.fileServer.rename(path, dest, function() {
        self.reload();

        var lastDoc = Doc.forPath(path);
        if (lastDoc) {
            lastDoc.setPath(dest);
            createTabs()
            tempSave(lastDoc.id, true)
            Doc.persist()
        }
    });
};
FileBrowser.prototype.filename = function(e) {
    var isFolder = false;
    if (e.endsWith("/"))
        isFolder = true;
    while (e.endsWith("/"))
        e = e.slice(0, e.length - 1);
    return e.substring(e.lastIndexOf("/") + 1, e.length) + (isFolder ? "/" : "")
}
FileBrowser.prototype.parent = function(e) {
    if (e == this.fileServer.getRoot() || !e.startsWith(this.fileServer.getRoot()))
        return this.fileServer.getRoot();
    while (e.endsWith("/"))
        e = e.slice(0, e.length - 1);
    return e.substring(0, e.lastIndexOf("/") + 1)
};
FileBrowser.prototype.reload = function(highlightNewFiles, callback) {
    var self = this;
    this.fileServer.getFiles(this.rootDir, function(res) {
        //console.log(res);
        self.updateHierarchy(res, highlightNewFiles);
        if (callback) callback();

    });
}
FileBrowser.prototype.onFileClicked = function() {
    const self = this;
    return function(e) {
        var filename = this.getAttribute("filename");
        e.stopPropagation();
        if (saveMode)
            if (newFileMode || confirm("Overwrite " + filename + "?")) {
                docs[currentDoc].setPath(self.rootDir + filename)
                docs[currentDoc].fileServer = self.fileServer.id;
                //basically update internals
                //real neat uh, I hope it works
                createTabs()
                tempSave(currentDoc, true)
                Doc.persist()
                FileBrowser.exitSaveMode();
                var content = docs[currentDoc].getValue();
                var lastDoc = currentDoc;
                saveDocs(currentDoc, function() {
                    updateIcon(lastDoc);
                });
                return;
            }
        var index = recentFolders.indexOf(self.rootDir);
        if (index > -1) {
            recentFolders = recentFolders.slice(0, index).concat(recentFolders.slice(index + 1));
        }
        recentFolders.unshift(self.rootDir);

        if (recentFolders.length > 5) recentFolders.pop();
        configure("recentFolders", recentFolders.join(","));
        var path = self.rootDir + filename;
        var b = Doc.forPath(path);
        if (b) {
            Doc.swapDoc(b.id);
        }
        else {
            self.fileServer.getFile(path, function(res, err) {
                var docId = addDoc(filename, res, path);
                docs[docId].fileServer = self.fileServer.id;
            });
        }
        $(".sidenav").sidenav("close");
    }
}
FileBrowser.prototype.updateHierarchy = function(hier, highlightNewFiles) {
    if (!highlightNewFiles)
        this.hier = null
    //console.log(hier);
    this.root.empty();
    //stub.append("<ul class='collection striped'></ul>");
    var root = this.root; //.children().last();
    sortlist = this.hier;
    hier = sort(hier, sort_mode)
    this.inflateChildren(hier, root, this.getTopEl());
    var a = root.find(".scroll-point")[0];
    if (a)
        root[0].scrollTop = Math.max(0, a.offsetTop - root[0].clientHeight * 0.5);
    else root[0].scrollTop = 0;
    this.hier = hier;
    this.updateHeader();
    var self = this;
    //this.updateClickListeners
    root.children().filter(".folder-item").click(this.onFolderClicked())
        .longTap({
            onRelease: function(e) {
                var b = e.delegateTarget.getBoundingClientRect();
                self.showCtxMenu(self.folderDropdown, e.delegateTarget) //e.delegateTarget.offsTop - e.delegateTarget.parentElement.scrollTop);

            }
        }).find("span.dropdown-btn").click((e) => {
            //console.log(e);

            self.showCtxMenu(self.folderDropdown, e.delegateTarget.parentElement);
            e.stopPropagation();
        });
    root.children().filter(".file-item").not(".folder-item").longTap({
        onRelease: function(e) {
            var b = e.delegateTarget.getBoundingClientRect();
            self.showCtxMenu(self.fileDropdown, e.delegateTarget) //e.delegateTarget.offsTop - e.delegateTarget.parentElement.scrollTop);
        }
    }).find("span.dropdown-btn").click((e) => {
        self.showCtxMenu(self.fileDropdown, e.delegateTarget.parentElement);
        e.stopPropagation();
    });
    root.children().not(".folder-item,.back-button").click(this.onFileClicked());

    if (this.onBackPressed) root.children(".back-button").click(this.onBackPressed())
    this.selectFile = null;
};
FileBrowser.prototype.createView = function(stub) {
    stub.empty();
    if (stub != this.stub) {
        console.warn("Changing stubs is not really supported")
    }
    if (stub.hasClass("fileview")) {
        this.root = this.stub;
        return
    }
    this.createHeader();
    this.stub.append("<ul class=\"fileview\"></ul>")
    this.root = stub.children().last();
}
FileBrowser.prototype.cancelRename = function() {
    var renameField = this.root.find("div").filter('.renameField');
    this.selected.show();
    renameField.detach();
};
FileBrowser.prototype.onCtxMenuClick = function(id) {
    var stub = this;
    var selected = this.selected;
    switch (id) {
        case "add-bookmark":
            if (bookmarks.indexOf(stub.rootDir)) {
                bookmarks.push(stub.rootDir);
            }
            break;
        case "reload-browser":
            stub.reload(true);
            break;
        case "open-tree":
            var tree = new Hierarchy(stub.root, stub.rootDir, stub.fileServer);
            tree.reload()
            break;
        case "rename-file":
        case "rename-folder":
            stub.cancelRename();

            selected.before(
                '<div class="renameField row" style="padding:10px;border-bottom:1px solid grey">' +
                '<div class="col s10 input-field inline">' +
                '<input id="new_file_name" value="' + selected.attr("filename").replace("/", "") + '"type="text" class="validate">' +
                '<span class="helper-text">Enter new name</span>' +
                '</div>' +
                '<span id="submitBtn" class="col s6 right"><i class="material-icons">done</i></span>' +
                '<span id="cancelBtn" class="col s3 right"><i class="material-icons">cancel</i></span>' +
                '</div');
            selected.prev().find("#submitBtn").click(function() {
                try {
                    stub.rename(selected, selected.prev().find("#new_file_name").val());
                    stub.cancelRename();
                }
                catch (e) {
                    console.error(e);
                }
            });
            selected.prev().find("#cancelBtn").click(function() {
                stub.cancelRename();
            });
            stub.dismissCtxMenu();
            selected.hide();
            break;
        case "open-file":
        case "open-folder":
            selected.click();
            break;
        case "new-browser":
            browserModal.open()
            break;
        case "new-tab":
            var folder = selected.attr("filename");
            var path = stub.rootDir+folder;
            FileBrowser.initBrowser({rootDir:path,server:stub.fileServer});
            break;
        case "open-project":
            var folder = selected.attr("filename") || "";
            //must update hierarchy to persist folder
            _hierarchy.fileServer = stub.fileServer;
            _hierarchy.setRootDir(stub.rootDir + folder);
            console.log(_hierarchy.rootDir);
            configure("hierarchyfileServer", _hierarchy.fileServer.id)
            _hierarchy.reload()
            break;
        case "new-file":
            this.dismissCtxMenu();
            var path = stub.rootDir;
            var name = "newfile";
            var i = 0;
            while (stub.hier.indexOf(name) > -1) {
                name = "newfile(" + (i++) + ")";
            }
            stub.fileServer.saveFile(path + name, "", function(ret) {
                stub.selectFile = name;
                stub.reload(true, function() {
                    stub.selected = stub.root.children(".selectFile");
                    newFileMode = true;
                    stub.onCtxMenuClick("rename-file");
                });
            });
            break;
        case 'copy-file-path':
            clipboard = stub.rootDir + selected.attr("filename");
            break;
        case "copy-file":
            mode = 0;
            copiedPath = {
                path: stub.rootDir + selected.attr("filename"),
                server: stub.fileServer,
            }
            $("#side-menu").removeClass("clipboard-empty")
            break;
        case "cut-file":
            mode = 1;
            copiedPath = {
                path: stub.rootDir + selected.attr("filename"),
                server: stub.fileServer,
            }
            $("#side-menu").removeClass("clipboard-empty")
            break;
        case "paste-file":
            if (copiedPath) {
                if (true || stub.fileServer == copiedPath.server) {
                    if (mode == 0) {
                        stub.fileServer.copyFile(copiedPath.path, stub.rootDir, function() {
                            M.toast({
                                html: "Pasted",
                                displayLength: 750
                            })
                            stub.reload()
                        });
                    }
                    else if (mode == 1) {
                        stub.fileServer.move(copiedPath.path, stub.rootDir, function() {
                            copiedPath = null;
                            stub.reload()
                            M.toast({
                                html: "Pasted",
                                displayLength: 750
                            })
                        });
                    }
                }
                else {
                    var content = copiedPath.server.getFile(copiedPath.path, function(res) {

                        stub.fileServer.saveFile(stub.rootDir + stub.filename(copiedPath.path), res, function() {
                            copiedPath = null;
                            M.toast({
                                html: "Downloaded",
                                displayLength: 750
                            })
                            stub.reload();
                            if (mode == 1) {
                                copiedPath.server.delete(copiedPath.path);
                            }
                        });

                    });
                }
            }
            break;
        case "delete-browser":
            FileBrowser.deleteBrowser(stub.id);
            break;
        case "delete-file":
        case "delete-folder":
            if (confirm("Delete " + selected.attr('filename') + "?"))
                stub.fileServer.delete(stub.rootDir + selected.attr("filename"), function() {
                    stub.reload();
                })
            break;
        case "new-folder":
            var path = stub.rootDir;
            var name = prompt("Enter folder name");
            if (name == null) return;
            stub.fileServer.newFolder(path + name);
            stub.reload(true);
            break;
        case "fold-all":
            stub.foldAll()
            break;
        case "expand-all":
            stub.expandAll()
            break;
        default:
            //alert("bummer");
            unimplemented();
    }
}
FileBrowser.prototype.dismissCtxMenu = function() {
    $(".fileview-dropdown").hide();
    document.body.removeEventListener("click", FileBrowser.temp, true);
    this.root[0].removeEventListener("scroll", FileBrowser.temp, true)
    this.root.children("li.selected").removeClass("selected");
    FileBrowser.activeFileBrowser = null;
}
FileBrowser.prototype.showCtxMenu = function(menu, el) {
    var stub = this;
    FileBrowser.activeFileBrowser = this;
    if (copiedPath == null)
        $("#side-menu").addClass("clipboard-empty")
    var menuId = "#" + menu
    var y = el.getBoundingClientRect().top + 40;
    this.selected = $(el);
    $(el).addClass("selected");
    var h = $(menuId).height();
    console.log(menuId);
    $(menuId).css("top", Math.max(0, y > document.body.clientHeight - h ? y - h - 60 : y)).fadeIn();
    $(menuId)[0].filebrowser = this; //.css("left",off.x-100).css("top",off.y).fadeToggle();
    document.body.addEventListener("click", FileBrowser.temp, true);
    this.root[0].addEventListener("scroll", FileBrowser.temp, true)
}

function Hierarchy(id, rootDir, fileServer) {
    FileBrowser.call(this, id, rootDir, fileServer, true);

    this.folderDropdown = "project-folder-dropdown";
    this.fileDropdown = "project-file-dropdown"
    var b = this.rootDir;
    this.fileServer = loadedServers[appConfig[this.id + "fileServer"]] || this.fileServer;
    this.setRootDir = (dir) => {
        if (dir == this.fileServer.getRoot()) {
            this.rootDir = dir
            this.hier=["/"]
        }
        else{
            this.rootDir = this.parent(dir);
            this.hier = [this.filename(dir)]
        }
        configure("root:" + this.id, this.rootDir + this.hier[0])
    }
    this.setRootDir(b)
    if (this.hier)
        this.updateHierarchy(this.hier)

}

Hierarchy.prototype = Object.create(FileBrowser.prototype);
Hierarchy.prototype.onFolderClicked = function() {
    var self = this;
    var e = function(ev) {
        ev.stopPropagation();
        self.toggleFolder($(this));
    }
    return e;
};
Hierarchy.prototype.createHeader = function() {
    return;
    //no headers
}
Hierarchy.prototype.getTopEl = function() {
    return null;
}
Hierarchy.prototype.find = function(text) {
    //Warning:  Invalid State if function fails
    var a = this.fileServer;
    this.fileServer = new FindFileServer(this.fileServer)
    this.fileServer.setFilter(text)
    this.reload();
    this.expandAll(this.foldAllEmpty.bind(this));
    this.fileServer = a;
}
Hierarchy.prototype.foldAllEmpty = function() {
    var folders = this.root.children(".folder-item");
    console.log(folders)
    var self = this;
    folders.each(function(i, e) {
        var a = $(e);
        if (a[0].childStub) {
            a[0].childStub.foldAllEmpty();
            if (a[0].childStub.root.children(".file-item").length > 0) {
                console.log("keep " + a[0].childStub.rootDir)
                console.log(a[0].childStub.root.children(".file-item"));
            }
            else {
                console.log("remove " + a[0].childStub.rootDir)
                a[0].childStub.stub.detach()
                a.detach()
            }
        }
    });
}
Hierarchy.prototype.expandAll = function(callback, counter) {
    if (!counter) {
        counter = { count: 0 }
    }
    var folders = this.root.children(".folder-item");
    var self = this;
    folders.each(function(i, e) {
        var a = $(e);
        counter.count++
            self.expandFolder(a, function() {
                var child = a[0].childStub;
                counter.count--
                    child.expandAll(callback, counter)
            })
    });
    if (counter.count == 0)
        setTimeout(callback, 1)
}
Hierarchy.prototype.foldAll = function(callback, counter) {
    var folders = this.root.children(".folder-item");
    var self = this;
    folders.each(function(i, e) {
        var a = $(e);
        if (a[0].childStub) {
            a[0].childStub.foldAll();
            self.foldFolder(a);
        }
    });
}
Hierarchy.prototype.reload = function() {
    const self = this;
    if (this.hier) {
        this.updateHierarchy(this.hier)
    }
}
Hierarchy.prototype.toggleFolder = function(el) {
    if (el[0].childStub && el[0].childStub.stub.css("display") != "none") {
        this.foldFolder(el);
    }
    else
        this.expandFolder(el);
}
Hierarchy.prototype.foldFolder = function(el) {
    var icon = el.find("i").eq(0);
    el[0].childStub.stub.hide();
    icon.text("folder");
}
Hierarchy.prototype.expandFolder = function(el, callback) {
    var c = el.attr("filename");
    var icon = el.find("i").eq(0);
    icon.text("folder_open");
    if (!(el[0].childStub)) {
        var childStub = el.after("<ul></ul>").next();
        childStub.addClass("fileview")
        if (callback) {
            el[0].childStub = new ChildStub(childStub, null, this.fileServer);
            el[0].childStub.setRootDir(this.rootDir + c)
            el[0].childStub.reload(false, callback);
        }
        else {
            el[0].childStub = new ChildStub(childStub, this.rootDir + c, this.fileServer);
            el[0].childStub.reload(false);
        }
    }
    else {
        el[0].childStub.stub.show();
        setTimeout(callback, 1)
    }
}
const superCtxClick = FileBrowser.prototype.onCtxMenuClick;
Hierarchy.prototype.onCtxMenuClick = function(id) {
    switch (id) {
        case "new-file":
        case "new-folder":
        case "paste-file":
            if (this.selected) {
                var selected = this.selected;
                this.expandFolder(this.selected, function() {
                    var childStub = selected[0].childStub;
                    childStub.selected = null;
                    childStub.onCtxMenuClick(id);
                });
                break;
            }
            /*fall through*/
        default:
            superCtxClick.apply(this, [id]);
    }
};

function ChildStub(id, rootDir, fileServer) {
    FileBrowser.call(this, id, rootDir, fileServer, true);
    this.folderDropdown = "project-folder-dropdown";
    this.fileDropdown = "project-file-dropdown"
}

ChildStub.prototype = Object.create(Hierarchy.prototype);
ChildStub.prototype.reload = FileBrowser.prototype.reload;

var browserModal;
FileBrowser.normalize = function(path) {
    path = path.split("/")
    var newpath = []
    for (var i in path) {
        if (!path[i] || path[i] === ".") continue;
        if (path[i] === "..") newpath.pop()
        else newpath.push(path[i])
    }
    path = "/" + newpath.join("/")
    if (path.length > 1) path += "/"
    return path
}
FileBrowser.createBrowser = function(id, fileServer, rootDir) {

    var newTab = '<li class="tab col s4 center">\
                <a href="#' + id + '">\
                    <i class="material-icons" style="width:100%">sd_storage</i>\
                </a>\
            </li>'
    $("#selector").prepend(newTab);

    var container = '<div id="' + id + '" class="fileview-container"></div>'
    $("#side-menu").append(container).children().last().hide();
    return new FileBrowser(id, rootDir, fileServer);
}
FileBrowser.initBrowser = function(params) {
    var server, id;
    if (params.server) {
        server = params.server;
        id = server.id || "undefined";
    }
    else {
        try {
            id = genId("s")
            server = FileBrowser.createServer(params.type, params);
            server.id = id;
            customServers[id] = params;
            loadedServers[id] = server;
            configure("customServers", JSON.stringify(customServers))
        }
        catch (e) {
            console.log("Failed to create server");
            return;
        }
    }
    var browser = FileBrowser.createBrowser(genId("f"),
        server,params.rootDir);
    customBrowsers[browser.id] = id
    _fileBrowsers.push(browser)
    configure("customBrowsers", JSON.stringify(customBrowsers))
    return browser;
}
FileBrowser.createServer = function(type, params) {
    var server = null;
    switch (type) {
        case "zip":
            unimplemented()
            break;
        case "local":
            return new AppFileServer(params.rootDir);
        case "rest":
            return new RESTFileServer(params.address, params.rootDir)
        default:
            unimplemented()
            break;
    }
}
FileBrowser.initDropdowns = function() {
    $(".fileview-dropdown").click(function(e) {
        this.filebrowser.onCtxMenuClick($(e.target).closest("a").attr("id"));
    })
    var a = $("#createBrowserModal");
    a.modal({
        inDuration: 100,
        outDuration: 100,
        onOpenStart: function() {
            a.find(".config").hide()
            a.find(".config-" + a.find('select').val()).show();
        },
        dismissible: false
    })
    browserModal = M.Modal.getInstance(a[0])
    a.find('select').on('change', function() {
        a.find(".config").hide()
        a.find(".config-" + a.find('select').val()).show();
    });
    a.find('#create').click(function() {
        var params = {}
        params.type = a.find('select').val();
        var e = a.find('.config-' + params.type)
        params.rootDir = FileBrowser.normalize(e.find('#rootDir').val())
        params.address = "" + (e.find('#address').val())
        if (!params.address.startsWith("http")) params.address = "http://" + params.address;
        var browser = FileBrowser.initBrowser(params)
        sidenavTabCtrlR.select(browser.id)
    });
}
FileBrowser.loadBrowsers = function() {
    for (var i in customServers) {
        var params = customServers[i];
        loadedServers[i] = FileBrowser.createServer(params.type, params)
        loadedServers[i].id = i
    }
    for (var i in customBrowsers) {
        register("root:" + i)
        var servrId = customBrowsers[i]
        var server = servrId ? loadedServers[servrId]:_fileServer;
        var browser = FileBrowser.createBrowser(i,
            server);
        _fileBrowsers.push(browser)
    }
    sidenavTabCtrlR.select("hierarchy")
}
FileBrowser.checkReferenceBesides = function(id, exclude) {
    for (var i in _fileBrowsers) {
        if (i == exclude) continue;
        if (i == "push") continue;
        if (_fileBrowsers[i].fileServer == loadedServers[id]) {
            return true;
        }
    }

    return false;
}
FileBrowser.getOpenDocs = function(id) {
    var openDocs = []
    for (var i in docs) {
        if (docs[i].fileServer == id) {
            openDocs.push(i)
        }
    }
    return openDocs;
}
FileBrowser.deleteBrowser = function(id) {
    if (!customBrowsers.hasOwnProperty(id)) throw new Error("deleting unexisting tab")
    if (customBrowsers[id] && !FileBrowser.checkReferenceBesides(customBrowsers[id], id)) {
        var openDocs = FileBrowser.getOpenDocs(customBrowsers[id])
        var refs;
        if (openDocs.length > 0) {
            refs = openDocs.map(function(i) { return docs[i].getSavePath() })
        }
        if (!refs || confirm("After this, the following files will not be able to save to this drive:\n" +
                refs.join("\n") + "\nContinue?")) {
            delete loadedServers[customBrowsers[id]]
            delete customServers[customBrowsers[id]]
            var o = 0;
            for (var i in openDocs) {
                delete docs[openDocs[i]].fileServer;
                docs[openDocs[i]].setPath("temp" + new Date().getTime() + "" + o++)
            }
        }
        else return;
    }
    delete customBrowsers[id]
    delete _fileBrowsers[id]
    appStorage.removeItem("root:" + id)
    configure("customBrowsers", JSON.stringify(customBrowsers))
    configure("customServers", JSON.stringify(customServers))
    tabController.select("hierarchy")
    var e = $("#side-menu").children("#" + id)
    e.remove()
    e = $("#selector").find(".tab a").filter("[href=\"#" + id + "\"]").parent()
    e.remove()
    sidenavTabCtrlR.select("file-browser")
}
FileBrowser.temp = function(e) {
    //	if(e.target.parentElement.getAttribute("id")!=)
    FileBrowser.activeFileBrowser.dismissCtxMenu();
    //if($(e.target).closest(".dropdown-btn").length<1){
    if ($(e.target).closest(".fileview-container").length > 0)
        e.stopPropagation();

    //}
    //e.preventDefault();
}
var saveMode, newFileMode;
FileBrowser.saveAs = function(doc) {
    saveMode = true;

    $("#save-text").css("display", "inline-block");
    $(".sidenav").sidenav("open");
}
FileBrowser.exitSaveMode = function() {
    saveMode = false;
    $("#save-text").css("display", "none");
}