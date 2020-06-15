"use strict";
registerAll({
    "searchTabFilter": "*.js,*.html,*.css",
    "searchOpenDocs": true
})
var markedDocuments;
var searchTimeout = 10000
var filter = appConfig.searchTabFilter;
filter = filter ? filter : "*";
var SearchTab = function(editor, el, modalEl) {
    // const worker = new Worker(
    //     URL.createObjectURL(new Blob(["(" + inlineWorker.toString() + ")()"], { type: 'text/javascript' })));

    // function inlineWorker() {
    //     /* eslint-disable no-restricted-globals */

    //     function findAll(re, text, path) {
    //         var matches = []
    //         re.replace(re, function(str) {
    //             matches.push({
    //                 offset: arguments[arguments.length - 2],
    //                 length: str.length
    //             });
    //         })
    //         self.postMessage({ path: path, matches: matches })
    //     }
    //     onmessage = function(e) {
    //         console.log('Message received from main script ' + JSON.stringify(e.data));
    //         findAll(e.data.re, e.data.text, e.data.path);
    //     }
    // }

    const self = this;
    var count = 0;
    var found = 0;
    var searchId = 0;
    this.el = el[0];
    this.$el = el;
    var results = el.children("#searchResults");
    this.rangelists = [];
    this.regExpOption = el.find("#toggleRegex");
    this.caseSensitiveOption = el.find("#caseSensitive");
    this.wholeWordOption = el.find("#toggleWholeWord");
    this.searchInput = el.find("#searchInput");
    this.replaceInput = el.find("#replaceInput");
    el.find(".ace_search_options").children().click(function() {
        $(this).toggleClass("checked");
    });
    modalEl.modal({
        dismissible: false
    })
    modalEl.find('input').filter('[type=checkbox]').next().click(function(e) { $(this).prev().click() });

    modalEl.find(".close-icon").click(function() {
        modalEl.modal('close');
        init();
    });
    modalEl.find("#includeOpenDocs")[0].checked = appConfig.searchOpenDocs;
    var relative = function(b, l) {
        if (l.startsWith(b))
            return l.slice(b.length, l.length);
        else {
            return null;

        }
    };
    //var glob = "*/*/*.js,*/*.js"
    var globToRegex = function(g) {
        var gl = g.split(",");
        var reg = "";
        for (var i of gl) {
            if (i.indexOf("/") > -1) {
                i = i.replace(/\.\//g, "");
                reg += "(^"
            }
            else reg += "("
            reg += (i.replace(new RegExp("\\*", "g"), "[^/]*") + "$)|");
        }
        return reg.slice(0, reg.length - 1)
    }
    var FilterFileServer = function() {
        var filter = "";
        var b = _hierarchy.fileServer;
        for (var i in _hierarchy.fileServer)
            this[i] = _hierarchy.fileServer[i]
        this.setFilter = function(glob) {
            filter = globToRegex(glob);
        }
        this.getFiles = function(path, callback) {
            b.getFiles(path, function(res) {
                var filtered = []
                for (i of res) {
                    console.log([_hierarchy.rootDir + _hierarchy.hier[0],path+i])
                    if (i.endsWith("/")) {
                        filtered.push(i)
                    }
                    else if (relative(_hierarchy.rootDir + _hierarchy.hier[0], path + i).match(filter)) {
                        filtered.push(i);
                    }
                }
                if (callback)
                    callback(filtered)
            })
        }

    }
    el.find("#searchConfig").click(function() {
        if (!_hierarchy.hier) {
            M.toast({ html: "No Project Folder!!", duration: 500 })
            //$("#includeOpenDocs")[0].checked=true
            return;
        }
        var filter = appConfig.searchTabFilter;
        filter = filter ? filter : "*"
        modalEl.modal("open");
        if (!self.filterFileBrowser)
            self.filterFileBrowser = new Hierarchy(modalEl.find(".fileview"), _hierarchy.rootDir + _hierarchy.hier[0], new FilterFileServer());
        else {
            self.filterFileBrowser.setRootDir(_hierarchy.rootDir + _hierarchy.hier[0])
        }
        self.filterFileBrowser.fileServer.setFilter(filter);
        self.filterFileBrowser.reload();
        $("#filterInput").val(filter)
    })
    $("#filterInput").change(function() {
        self.filterFileBrowser.fileServer.setFilter($(this).val())
        configure("searchTabFilter", $(this).val())
        self.filterFileBrowser.reload();
    })
    el.find("#toggleReplace").click(
        function() {
            if (el.hasClass("show_replace")) {
                el.removeClass('show_replace')
                $(this).text("keyboard_arrow_down")
            }
            else {
                el.addClass('show_replace')
                $(this).text("keyboard_arrow_up")
            }
        })
    this.search = new(ace.require("ace/search").Search)();

    el.find("#searchbtn").click(function() {
        searchId += 1
        results.html("")
        results.append("<span id='search_info'></span>")
        self.search.setOptions({
            needle: self.searchInput.val(),
            wrap: false,
            regExp: self.regExpOption.hasClass("checked"),
            caseSensitive: self.caseSensitiveOption.hasClass("checked"),
            wholeWord: self.wholeWordOption.hasClass("checked"),
        });
        if ($("#includeOpenDocs")[0].checked) {
            for (var doc in docs)
                if (docs[doc]) {
                    var ranges = self.search.findAll(docs[doc].session);
                    inflateResults(docs[doc], ranges, results)
                }

            el.find("#moreResults").hide();
        }
        else {
            for (var i = 0; i < Math.min(searchDocs.length, 10); i++) {
                let e = searchDocs[i]
                var doc;
                if (doc = Doc.forPath(e)) {
                    var ranges = self.search.findAll(doc.session);
                    inflateResults(doc, ranges, results)
                }
                else
                    asyncSearch(e, self.filterFileBrowser.fileServer, new Date().getTime() + searchTimeout, searchId);
            }
            count = i;
            if (i < searchDocs.length) {
                el.find("#moreResults").show();

            }
            else {
                el.find("#moreResults").hide();
            }
        }

    });
    el.on("click", ".foldResult", function() {
        var a = $(this).closest(".searchResultTitle").next()
        if (a.css("display") == "none") {
            a.show();
            $(this).html("keyboard_arrow_up")
        }
        else {
            a.hide()
            $(this).html("keyboard_arrow_down")

        }

    })
    el.find("#moreResults").click(function() {
        for (var i = count; i < Math.min(searchDocs.length, count + 10); i++) {
            let e = searchDocs[i]
            var doc;
            if (doc = Doc.forPath(e)) {
                var ranges = self.search.findAll(doc.session);
                inflateResults(doc, ranges, results)
            }
            else
                asyncSearch(e, self.filterFileBrowser.fileServer, new Date().getTime() + searchTimeout, searchId)
        }
        count = i;
        if (i < searchDocs.length) {
            el.find("#moreResults").show();

        }
        else {
            el.find("#moreResults").hide();
        }
    })
    el.find("#replacebtn").click(function() {
        var replacement = self.replaceInput.val();
        var replaced = 0;
        if ($("#includeOpenDocs")[0].checked) {
            for (var dc in docs)
                if (docs[dc]) {
                    var doc = docs[dc];
                    var ranges = self.search.findAll(doc.session);
                    for (var i = ranges.length - 1; i >= 0; --i) {
                        if ($tryReplace(doc.session, ranges[i], replacement)) {
                            replaced++;
                        }
                    }
                }
        }
        else
            for (var p = 0; p < count; p++) {
                let e = searchDocs[p];
                var doc = Doc.forPath(e)
                if (doc && tabs.indexOf(doc.id) > -1) {
                    var ranges = self.search.findAll(doc.session);
                    for (var i = ranges.length - 1; i >= 0; --i) {
                        if ($tryReplace(doc.session, ranges[i], replacement)) {
                            replaced++;
                        }
                    }
                }
                else
                    self.filterFileBrowser.fileServer.getFile(e, function(res) {
                        doc = new Doc(res, e)
                        var ranges = self.search.findAll(doc.session);
                        for (var i = ranges.length - 1; i >= 0; --i) {
                            if ($tryReplace(doc.session, ranges[i], replacement)) {
                                replaced++;
                            }
                        }
                        var id = doc.id;
                        saveDocs(doc.id, function() {
                            closeDoc(id);
                        }, true)
                    })

            }
    })
    var $tryReplace = function(session, range, replacement) {
        var input = session.getTextRange(range);
        replacement = self.search.replace(input, replacement);
        if (replacement !== null) {
            range.end = session.replace(range, replacement);
            return range;
        }
        else {
            return null;
        }
    };
    var searchDocs = [];
    var addFile = function(e) {
        searchDocs.push(e)
    }
    var addFolder = function(e) {
        self.filterFileBrowser.fileServer.getFiles(e, function(res) {
            var folders = []
            for (var i of res) {
                if (i.endsWith("/")) {
                    folders.push(e + i)
                }
                else if (i.startsWith("."))
                    continue;
                else
                    addFile(e + i)
            }
            for (i in folders) addFolder(folders[i])

        })
    }

    function inflateResults(doc, ranges) {
        var lastLine = -1;
        if (ranges.length > 0) {

            results.append("<div class=\"searchResultTitle\"><h6 class='clipper searchResultFile'>" + doc.getPath() + "</h6>" +
                "<div class='edge_box-1 h-30'><i class='fill_box center'>" + ranges.length + " results  </i><i class='material-icons side-1 foldResult'>keyboard_arrow_up</i></div></div>");
            var resultsList = document.createElement("ul");
            results[0].appendChild(resultsList)
            resultsList = $(resultsList)
            for (var rangeId in ranges) {
                var range = ranges[rangeId];
                var lines = doc.session.getLines(range.start.row, range.end.row)
                //var lines = ["var a = hello;b = hi; c = brave","var a = hello;b = hi; c = brave"]
                resultsList.append("<li><span id='line-number'></span><span id='start'></span><span id ='result'></span><span id='end'></span></li>");
                //range.end.row+=1
                //range.end.column=5;
                var element = resultsList.children().last();
                element.children("#line-number").text("" + (range.start.row + 1));
                var rw, cw = element[0].clientWidth-element.children("#line-number")[0].clientWidth;
                var elRes = element.children("#result")[0];
                if (lines.length == 1) {
                    var result = lines[0].substring(range.start.column, range.end.column);
                    $(elRes).text(result);
                    rw = elRes.getBoundingClientRect().right-elRes.getBoundingClientRect().left;

                }
                else {
                    var result = lines[0].substring(range.start.column);
                    elRes.appendChild(document.createTextNode(result));
                    elRes.innerHTML += "&nbsp;"
                    rw = elRes.getBoundingClientRect().right-elRes.getBoundingClientRect().left;
                    elRes.appendChild(document.createElement("br"));
                    elRes.innerHTML += "&nbsp;&rdsh;";
                    for (var i = 1; i < lines.length - 1; i++) {
                        elRes.appendChild(document.createTextNode(lines[i]));
                        elRes.innerHTML += "&nbsp;"
                        elRes.appendChild(document.createElement("br"));
                        elRes.innerHTML += "&nbsp;&rdsh;";
                    }
                    elRes.appendChild(document.createTextNode(lines[i].substring(0, range.end.column)))
                }
                var startEl = element.children("#start");

                var start = lines[0].substring(0,range.start.column);
                var free_space = Math.floor((cw-rw)/(rw/result.length));
                var s = 0,e=0,m = free_space/2;
                var end = lines[lines.length - 1].substring(range.end.column);
                console.log({ 'm': m, 'free_space': free_space, 'endl' : end.length });
                s = Math.min(start.length,Math.max(m,free_space-end.length-1));
                console.log(s)
                start = start.substring(start.length-s);
                element.children("#start").text(start)
                //var .children("#end")[0].getBoundingClientRect().left);
                    /*Math.max(range.end.column, Math.min(
                        (lines.length == 1 ? Math.max(0, range.start.column - 10) : 0) + 40,
                        lines[lines.length - 1].length)))*/

                resultsList.children().last().children("#end").text(end)
                resultsList.css("font-family", $("#editor").css("font-family"))
                resultsList.addClass("ace_editor")
                resultsList.addClass("resultsList")
                resultsList.addClass(editor.renderer.theme.cssClass)
                resultsList.children().addClass("ace_line")
                resultsList.children().last().css("line-height", editor.renderer.layerConfig.lineHeight + "px")
                resultsList.children().last().css("font-size", $("#editor").css("font-size"))
                resultsList.children().last().click(
                    (function(path, range) {
                        return function(e) {
                            var doc;
                            if ((doc = Doc.forPath(path))) {
                                addDoc(doc)
                                editor.findAll("", self.search.getOptions());
                                editor.renderer.scrollSelectionIntoView(range.start, range.end, 0.5)
                            }

                            else {
                                _hierarchy.fileServer.getFile(path, function(res) {
                                    doc = docs[addDoc("", res, path)]
                                    editor.findAll("", self.search.getOptions());
                                    editor.renderer.scrollSelectionIntoView(range.start, range.end, 0.5)
                                })
                            }
                            $('.sidenav').sidenav('close')
                        }
                    })(doc.getPath(), range)
                );

            }
        }
    }

    function asyncSearch(path, fileServer, timeout, id) {
        //If file is already 
        //opened search synchronously
        if (id != searchId) return;
        var doc;
        var search = function() {
            var ranges = self.search.findAll(doc.session);
            if (ranges.length < 1 && new Date().getTime() < timeout) {
                //spawn a new search
                if (count < searchDocs.length) {
                    asyncSearch(searchDocs[count], fileServer, timeout, id);
                    count += 1
                    $("#search_info").html(searchDocs[count])
                    if (count == searchDocs.length)
                        el.find("#moreResults").hide();
                }
            }
            inflateResults(doc, ranges, results)
        }
        if (doc = Doc.forPath(path))
            search()
        else
            fileServer.getFile(path, function(res) {
                if (id != searchId) return;
                doc = new Doc(res, path)
                try {
                    search()
                }
                catch (e) {
                    console.error(e) //new Error('Error during async search'))
                }
                closeDoc(doc.id);
            })
    }

    function init() {
        searchDocs = []
        addFolder(_hierarchy.rootDir + _hierarchy.hier[0])
    }

    this.init = init;
}