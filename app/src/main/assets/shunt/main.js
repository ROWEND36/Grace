registerAll({
    "lastRun": undefined,
    "autosave": true,
    "currentDoc": ""
})
var lastRun = appConfig.lastRun;
var tabs = [];
var runPaths = {};
var ternSupportedDocs = {
    "ace/mode/javascript": true,
    "ace/mode/html": true,
    "ace/mode/php": true
}
var toReload = []
var docs = {}
var currentDoc = appConfig.currentDoc;

Doc.numDocs = function() {
    var num = 0;
    for (var i in docs) num++;
    return num;
};

function tempSave(id, force) {
    if (id !== undefined) {
        appStorage.setItem(id, JSON.stringify(docs[id].serialize()));
        docs[id].safe = true;

    }
    else
        for (var i in docs)
            if (!docs[i].safe || force) {
                tempSave(i);
            }
}

function getFileServer(id) {
    return (docs[id].fileServer && loadedServers[docs[id].fileServer]) || _fileServer;
}

function saveDocs(id, callback, force) {
    //save all non shadow docs
    //or specified doc
    if (id !== undefined) {
        var a = getFileServer(id);
        a.saveFile(docs[id].path, docs[id].getValue(), function() {
            docs[id].dirty = false;
            callback(id)
        });
    }
    else {
        for (var i in docs)
            if ((docs[i].dirty || force) && !docs[i].shadowDoc)
                saveDocs(i, callback)
    }
}

function Doc(content, path, mode, id) {
    //documents are a link to paths
    //no two documents can have the same
    //path for now or one will overwrite
    //the other
    //To edit multiple copies of a document
    //You can create a new file
    //using Doc constructor is useful
    //only if you want to reset a session
    if (id) {
        this.id = id;
    }
    else {
        this.id = "m" + new Date().getTime();
    }
    this.setPath(path);
    var session = this.session = new EditSession(content, mode);
    if (docs[id])
        console.error("Creating doc with existing id")
    docs[this.id] = this;
    session.setUndoManager(new ace.UndoManager());
    //needs saving
    this.dirty = false;
    this.fileServer = null;
    //needs saving temp
    this.safe = false;

}
Doc.prototype.getPath = function() {
    return this.shadowDoc ? this.path + "~~" + this.shadowDoc : this.path;
}
Doc.prototype.setPath = function(path) {
    if (path == this.path) return;
    if (Doc.forPath(path)) {
        //0 would test false
        this.shadowDoc = 1;
        var a;
        while ((a = Doc.forPath(path + "~~" + this.shadowDoc))) {
            this.shadowDoc++;
            if (a == this) throw new Error("Infinite Looping caught!!")
        }
        this.autosave = false
        console.error("Warning: Document already opened")
        M.toast({ html: "Warning: Document already opened", duration: 1000 })
    }
    this.path = path;

}
Doc.prototype.getSavePath = function() {
    return this.path
}
Doc.prototype.resetHistory = function() {
    session.setUndoManager(new ace.UndoManager());
}
Doc.prototype.serialize = function() {
    var obj = sessionToJson(this.session)
    obj.dirty = this.dirty
    obj.safe = this.safe
    obj.fileServer = this.fileServer;
    obj.autosave = this.autosave;
    obj.shadowDoc = this.shadowDoc
    return obj;
}
Doc.prototype.unserialize = function(json) {
    var obj = json;
    this.dirty = obj.dirty;
    //this.fileServer = obj.fileServer?
    //path deliberately not copied
    this.safe = true;
    this.fileServer = obj.fileServer;
    this.shadowDoc = obj.shadowDoc;
    this.autosave = obj.autosave;
    jsonToSession(this.session, obj);
}
Doc.prototype.setValue = function(e) { this.session.getDocument().setValue(e) };
Doc.prototype.getValue = function() { return this.session.getValue() };
var filterHistory = function(deltas) {


    return deltas.filter(function(d) {
        return d.action != "removeFolds";
    });
};

function sessionToJson(session) {
    return {
        content: session.getValue(),
        selection: session.getSelection().toJSON(),
        options: session.getOptions(),
        mode: session.getMode().$id,
        scrollTop: session.getScrollTop(),
        scrollLeft: session.getScrollLeft(),
        history: {
            undo: session.getUndoManager().$undoStack.map(filterHistory),
            redo: session.getUndoManager().$redoStack.map(filterHistory)
        },
        folds: session.getAllFolds().map(function(fold) {
            return {
                start: { row: fold.start.row, column: fold.start.column },
                end: { row: fold.end.row, column: fold.end.column },
                placeholder: fold.placeholder
            };
        })
    }
}

/** @param {AceAjax.Editor} editor */
function jsonToSession(session, state) {
    var Range = ace.require('ace/range').Range;
    session.setValue(state.content);
    session.selection.fromJSON(state.selection);
    session.setOptions(state.options);
    session.setMode(state.mode);
    session.setScrollTop(state.scrollTop);
    session.setScrollLeft(state.scrollLeft);
    session.$undoManager.$undoStack = state.history.undo;
    session.$undoManager.$redoStack = state.history.redo;
    try {
        state.folds.forEach(function(fold) {
            session.addFold(fold.placeholder, Range.fromPoints(fold.start, fold.end));
        });
    }
    catch (e) { console.log('Fold exception: ' + e) }
}
Doc.forPath = function(path) {
    var shadow = null
    for (var i in docs) {
        if (docs[i].getPath() == path) {
            return docs[i];
        }
    }
    return null;
};
Doc.toJSON = function() {
    var h = {}
    for (var i in docs) {
        if (tabs.indexOf(i) > -1)
            h[i] = docs[i].getSavePath();
    }
    return JSON.stringify(h)
}
Doc.fromJSON = function(json) {
    var jj = JSON.parse(json)
    docs = {}
    for (var i in jj) {
        docs[i] = new Doc("", jj[i], undefined, i);
        var state = appStorage.getItem(i);
        if (state)
            try {
                state = JSON.parse(state)
            }
        catch (e) {
            state = null
            M.toast({ html: "Error loading save for </br>" + jj[i], duration: 1000 })
            //maybe later we can do recovery
            //for now blah, I feel I will regret this
        }
        if (state) {
            docs[i].unserialize(state);
            addDoc(filename(jj[i]), docs[i], undefined, state.mode);
        }
        else {
            addDoc(filename(jj[i]), docs[i]);
            //todo this will likely be a problem
            if (!(jj[i].startsWith("temp"))) {
                toReload.push(docs[i])
            }
        }
    }
}

Doc.persist = function() {
    appStorage.setItem("tabs", tabs.join(","))
    appStorage.setItem("docs", Doc.toJSON())
}
Doc.swapDoc = function(id, fromClick) {
    $("#opendocs").children().removeClass('activeTab');
    $("#opendocs").children('[data-file="' + id + '"]').addClass('activeTab')
    $("#status-filename").text(docs[id].getSavePath())
    if (fromClick) {
        updateIcon(id)
        editor.setSession(docs[id].session);
    }
    else {
        var menu = $("#menu")[0]
        var child = $("#menu .tab a").filter('[href="#' + id + '"]').parent()[0]
        if (child) {
            menu.scrollLeft = -menu.clientWidth / 2 + (child.clientWidth) / 2 + child.offsetLeft;
            tabController.select(id);
        }
    }
}

var filename = function(e) {
    var isFolder = false;
    if (e.endsWith("/"))
        isFolder = true;
    while (e.endsWith("/"))
        e = e.slice(0, e.length - 1);
    return e.substring(e.lastIndexOf("/") + 1, e.length) + (isFolder ? "/" : "")
}

function addDoc(name, content /*-doc-*/ , path, mode /*-use true to keep mode-*/ ) {
    var b, doc;
    //use cases in searchtab addDoc(,doc,path)
    //main use adddoc(,doc,path,mode)
    //filebrowser adddoc(n,c,p)
    if (typeof name == "object") {
        doc = name
        name = undefined;
        content = undefined;
        //console.warn('Use of deprecated api addDoc(doc)')
    }
    else if (typeof content == "object") {
        doc = content
        content = undefined
    }
    if (doc) {
        path = doc.getPath()
        if (!mode) {
            mode = modelist.getModeForPath(path).mode;
            doc.session.setMode(mode)
        }
        else {
            //get mode will fail if set mode
            //was called earlier as that one is
            //a callback method
            mode = doc.session.getMode(doc).$id
        }
    }
    else {
        if (!mode)
            mode = modelist.getModeForPath(path).mode;
        doc = new Doc(content, path, mode)
    }
    //considering removing the name test
    //or at least push it to last param
    if (!name) {
        if (path)
            name = filename(path) || name;
        else
            name = "unsaved(" + tabs.length + ")"
    }
    //Hope I got mode from every possibility
    //beautiful side effect here is that
    //we can use this to refresh tern
    //Still not loving the fact that
    //we have session and Doc
    //or docs and ts.docs
    //maybe in the future we'll
    //merge session and Doc

    if (tabs.indexOf(doc.id) < 0) {
        var tab = createTabEl(name, doc.id)
        $("#menu").append(tab);
        tab = createListEl(name, doc.id)
        $("#opendocs").append(tab)
        tabs.push(doc.id);
        if (ternSupportedDocs.hasOwnProperty(mode)) {
            if (editor.ternServer)
                editor.ternServer.addDoc(doc.getPath(), doc.session)
        }
        Doc.persist()
    }
    tabController.select(doc.id);
    return doc.id;
    //$(".tabs").eq(last-1).eq(0).trigger("click");//removeClass("active");
    //$(".tabs").eq(last-1).eq(0).setClass("active");


}
var createTabEl = function(name, id) {
    return '<li class="tab col s4" data-file=' + id +
        '><a href=#' + id + ' >' + name +
        '<i class="material-icons close-icon">close</i></a></li>'

}
var createListEl = function(name, id) {
    return '<li class="file-item" data-file=' + id +
        '><i class="material-icons">insert_drive_file</i>' +
        '<span style="margin-left:10px">' + name +
        '</span><span class="dropdown-btn">' +
        '<i class="material-icons">close</i></span></li>'
}

var createTabs = function() {
    console.log("Creating tabs")
    $("#menu").empty();
    $("#opendocs").empty()
    var tab;
    var doc;
    for (var i = 0; i < tabs.length; i++) {
        if (doc = docs[tabs[i]]) {
            var namefile = (doc.getPath().startsWith("temp") ? "unsaved(" + i + ")" : filename(doc.getPath()));
            tab = createTabEl(namefile, doc.id);
            $("#menu").append(tab);
            tab = createListEl(namefile, doc.id)
            $("#opendocs").append(tab)
        }
        else
            console.error("Tab for invalid document id")

    }
    Doc.swapDoc(currentDoc)
}
var deleteTab = function(id) {
    $("#menu .tab a").filter('[href="#' + id + '"]').parent().remove();
    $("#opendocs").children('[data-file="' + id + '"]').remove();
}

function dragTab(oldIndex, newIndex) {
    /*var old = $("#menu").children().eq(oldIndex)
    var content = '<li class="tab col s4" data-file=' + old.attr("data-file") + '>' + old.html() + '</li>'
    var newI = $("#menu").children().eq(newIndex)
    if (newI.length > 0)
        newI.before(content)
    else
        $("#menu").append(content)

    old.remove()*/
    var min = Math.min(oldIndex, newIndex)
    var max = Math.max(newIndex, oldIndex)
    var head = tabs.slice(0, min)
    var middle = tabs.slice(min, max + 1)
    var tail = tabs.slice(max + 1, tabs.length)
    if (oldIndex > newIndex)
        head.push(middle.pop())
    else
        middle.push(middle.shift())
    tabs = head.concat(middle).concat(tail)
    createTabs();
    appStorage.setItem("tabs", tabs.join(","))

}

function closeDoc(docId, replace) {
    if (appStorage.getItem(docId)) {
        if (!docs[docId].safe) console.error("Safe doc without safe flag")
        appStorage.removeItem(docId);
    }
    else {
        if (docs[docId].safe) console.error("Unsafe doc with safe flag")
    }

    //if not in hierarchy, i guess
    //editor.ternServer.delDoc()
    if (docs.hasOwnProperty(docId))
        delete docs[docId]
    if (tabs.indexOf(docId) > -1) {
        var t = tabs.indexOf(docId);
        tabs[t] = undefined;
        tabs = tabs.filter(function(e) { return e != undefined })
        //if replace, we'll recreate createTabs
        //anyway
        deleteTab(docId);
        if (!replace) {
            if (tabs.length == 0) {
                newFile();
            }
            else
                tabController.select(tabs[t] || tabs[t - 1]);
        }
        Doc.persist()
    }
    if (Doc.numDocs() != tabs.length) {
        //All shadow docs should be closed as they
        //are opened so this should not happen
        console.error("File leak")
    }


}