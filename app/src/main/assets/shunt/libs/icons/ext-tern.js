

ace.define("ace/tern/tern_server",["require","exports","module","ace/range","ace/lib/dom"], function (require, exports, module) {
    "use strict";
    var TernServer = function (options) {
        var self = this;
        this.options = options || {};
        var plugins = this.options.plugins || (this.options.plugins = {});
        if (!plugins.hasOwnProperty('doc_comment')) plugins.doc_comment = {};
        if (!plugins.doc_comment.hasOwnProperty('fullDocs')) plugins.doc_comment.fullDocs = true; //default to true if not specified
        if (!this.options.hasOwnProperty('switchToDoc')) this.options.switchToDoc = function (name, start) {
            console.log('tern.switchToDoc called but not defined (need to specify this in options to enable jumpting between documents). name=' + name + '; start=', start);
        };
        if (!this.options.hasOwnProperty('defs')) this.options.defs = [ /*'jquery',*/ 'browser', 'ecma5'];
        if (!this.options.hasOwnProperty('useWorker')) this.options.useWorker = true;
        if (this.options.useWorker) {
            this.server = new WorkerServer(this, this.options.workerClass);
        }
        else {
            if (this.options.defs && this.options.defs.length > 0) {
                var tmp = [];
                for (var i = 0; i < this.options.defs.length; i++) {
                    tmp.push(eval('def_' + this.options.defs[i]));
                }
                this.options.defs = tmp;
            }

            this.server = new tern.Server({
                getFile: function (name, c) {
                    return getFile(self, name, c);
                },
                async: true,
                defs: this.options.defs,
                plugins: this.options.plugins
            });
        }

        this.docs = Object.create(null);
        this.trackChange = function (change, doc) {
            trackChange(self, doc, change);
        };
        this.cachedArgHints = null;
        this.activeArgHints = null;
        this.jumpStack = [];
        this.aceTextCompletor = null;
        this.lastAutoCompleteFireTime = null;
        this.queryTimeout = 3000;
        if (this.options.queryTimeout && !isNaN(parseInt(this.options.queryTimeout))) this.queryTimeout = parseInt(this.options.queryTimeout);
    };
    var Pos = function (line, ch) {
        return {
            "line": line,
            "ch": ch
        };
    };
    var cls = "Ace-Tern-";
    var bigDoc = 250;
    var aceCommands = {
        ternJumpToDef: {
            name: "ternJumpToDef",
            exec: function (editor) {
                editor.ternServer.jumpToDef(editor);
            },
            bindKey: "Alt-."
        },
        ternJumpBack: {
            name: "ternJumpBack",
            exec: function (editor) {
                editor.ternServer.jumpBack(editor);
            },
            bindKey: "Alt-,"
        },
        ternShowType: {
            name: "ternShowType",
            exec: function (editor) {
                editor.ternServer.showType(editor);
            },
            bindKey: "Ctrl-I"
        },
        ternFindRefs: {
            name: "ternFindRefs",
            exec: function (editor) {
                editor.ternServer.findRefs(editor);
            },
            bindKey: "Ctrl-E"
        },
        ternRename: {
            name: "ternRename",
            exec: function (editor) {
                editor.ternServer.rename(editor);
            },
            bindKey: "Ctrl-Shift-E"
        },
        ternRefresh: {
            name: "ternRefresh",
            exec: function (editor) {
                var full = false;
                if (editor.ternServer.refreshDocLastCalled != null) {
                    if (new Date().getTime() - editor.ternServer.refreshDocLastCalled < 1000) { //less than 1 second
                        full = true;
                    }
                }
                editor.ternServer.refreshDocLastCalled = new Date().getTime();
                editor.ternServer.refreshDoc(editor, full);
            },
            bindKey: "Alt-R"
        },
    };
    var debugCompletions = false;
    
    TernServer.prototype = {
        bindAceKeys: function (editor) {
            for (var p in aceCommands) {
                var obj = aceCommands[p];
                editor.commands.addCommand(obj);
            }
        },
        addDoc: function (name, doc) {
            var data = {
                doc: doc,
                name: name,
                changed: null
            };
            var value = '';
            if (doc.constructor.name === 'String') {
                value = doc;
            }
            else {
                value = docValue(this, data);
                doc.on("change", this.trackChange);
            }
            this.server.addFile(name, value);
            return this.docs[name] = data;
        },
        delDoc: function (name) {
            var found = this.docs[name];
            if (!found) return;
            try { //stop tracking changes
                found.doc.off("change", this.trackChange);
            }
            catch (ex) {}
            delete this.docs[name];
            this.server.delFile(name);
        },
        hideDoc: function (name) {
            closeAllTips();
            var found = this.docs[name];
            if (found && found.changed) sendDoc(this, found);
        },
        refreshDoc: function (editor, full) {
            var showTip = function (msg) {
                var el = document.createElement('span');
                el.setAttribute('style', 'color:green;');
                el.innerHTML = msg;
                tempTooltip(editor, el, 2000);
            };

            if (full) {
                this.docChanged(editor);
                showTip('Tern fully refreshed (reloaded current doc and all refs)');
                return;
            }

            var doc = findDoc(this, editor);
            sendDoc(this, doc);
            showTip('Tern document refreshed <div style="color:gray; font-size:smaller;">(press hotkey twice in  &lt; 1 second to do a full reload including refs)</div>');
        },
        getCompletions: function (editor, session, pos, prefix, callback) {
            getCompletions(this, editor, session, pos, prefix, callback);
        },
        showType: function (editor, pos, calledFromCursorActivity) {
            showType(this, editor, pos, calledFromCursorActivity);
        },
        updateArgHints: function (editor) {
            updateArgHints(this, editor);
        },
        jumpToDef: function (editor) {
            jumpToDef(this, editor);
        },
        jumpBack: function (editor) {
            jumpBack(this, editor);
        },
        rename: function (editor) {
            rename(this, editor);
        },
        findRefs: function (editor) {
            findRefs(this, editor);
        },
        request: function (editor, query, c, pos, forcePushChangedfile) {
            var self = this;
            var doc = findDoc(this, editor);
            var request = buildRequest(this, doc, query, pos, forcePushChangedfile);

            this.server.request(request, function (error, data) {
                if (!error && self.options.responseFilter) data = self.options.responseFilter(doc, query, request, error, data);
                c(error, data);
            });
        },
        enabledAtCurrentLocation: function (editor) {
            return inJavascriptMode(editor) && atInterestingExpression(editor);
        },
        getCallPos: function (editor, pos) {
            return getCallPos(editor, pos);
        },
        docChanged: function (editor) {
            var sf = this;
            for (var p in this.docs) {
                this.delDoc(p);
            }

            var finish = function (name) {
                sf.addDoc(name, editor); //add current doc
                loadExplicitVsRefs(sf, editor);
            };

            if (this.options.getCurrentFileName) {
                this.options.getCurrentFileName(finish);
            }
            else {
                finish('current'); //name the file current
            }
        },
        restart: function () {
            if (!this.options.useWorker) return;
            this.server.restart(this);
        },
        debug: function (message) {
            if (!message) {
                console.log('debug commands: files, filecontents');
                return;
            }
            if (!this.options.useWorker) return;
            this.server.sendDebug(message);
        },
        debugCompletions: function (value) {
            if (value) debugCompletions = true;
            else debugCompletions = false;
        },
    };
    exports.TernServer = TernServer;
    function resolveFilePath(ts, name, cb) {
        if (ts.options.resolveFilePath) {
            ts.options.resolveFilePath(name, cb);
        }
        else {
            cb(name); //return original name
        }
    }
    function getFile(ts, name, cb) {
        var buf = ts.docs[name];
        if (buf) cb(docValue(ts, buf));
        else if (ts.options.getFile) ts.options.getFile(name, cb);
        else cb(null);
    }
    function findDoc(ts, doc, name) {
        for (var n in ts.docs) {
            var cur = ts.docs[n];
            if (cur.doc == doc) return cur;
        }
        if (!name)
            for (var i = 0;; ++i) {
                n = "[doc" + (i || "") + "]"; //name not passed for new doc, so auto generate it
                if (!ts.docs[n]) {
                    name = n;
                    break;
                }
            }
        return ts.addDoc(name, doc);
    }
    function toTernLoc(pos) {
        if (typeof (pos.row) !== 'undefined') {
            return {
                line: pos.row,
                ch: pos.column
            };
        }
        return pos;
    }
    function toAceLoc(pos) {
        if (pos.line>-1) {
            return {
                row: pos.line,
                column: pos.ch
            };
        }
        return pos;
    }
    function buildRequest(ts, doc, query, pos, forcePushChangedfile) {
        var files = [],
            offsetLines = 0,
            allowFragments = !query.fullDocs;
        if (!allowFragments) {
            delete query.fullDocs;
        }
        if (typeof query == "string") {
            query = {
                type: query
            };
        }

        query.lineCharPositions = true;
        if (query.end == null) { //this is null for get completions
            var currentSelection = doc.doc.getSelectionRange(); //returns range: start{row,column}, end{row,column}
            query.end = toTernLoc(pos || currentSelection.end);
            if (currentSelection.start != currentSelection.end) {
                query.start = toTernLoc(currentSelection.start);
            }
        }

        var startPos = query.start || query.end;

        if (doc.changed) {
            if (!forcePushChangedfile && doc.doc.session.getLength() > bigDoc && allowFragments !== false && doc.changed.to - doc.changed.from < 100 && doc.changed.from <= startPos.line && doc.changed.to > query.end.line) {
                files.push(getFragmentAround(doc, startPos, query.end));
                query.file = "#0";
                var offsetLines = files[0].offsetLines;
                if (query.start != null) query.start = Pos(query.start.line - -offsetLines, query.start.ch);
                query.end = Pos(query.end.line - offsetLines, query.end.ch);
            }
            else {
                files.push({
                    type: "full",
                    name: doc.name,
                    text: docValue(ts, doc)
                });
                query.file = doc.name;
                doc.changed = null;
            }
        }
        else {
            query.file = doc.name;
        }
        for (var name in ts.docs) {
            var cur = ts.docs[name];
            if (cur.changed && cur != doc) {
                files.push({
                    type: "full",
                    name: cur.name,
                    text: docValue(ts, cur)
                });
                cur.changed = null;
            }
        }

        return {
            query: query,
            files: files,
            timeout: ts.queryTimeout
        };
    }
    function getFragmentAround(data, start, end) {
        var editor = data.doc;
        var minIndent = null,
            minLine = null,
            endLine,
            tabSize = editor.session.$tabSize;
        for (var p = start.line - 1, min = Math.max(0, p - 50); p >= min; --p) {
            var line = editor.session.getLine(p),
                fn = line.search(/\bfunction\b/);
            if (fn < 0) continue;
            var indent = countColumn(line, null, tabSize);
            if (minIndent != null && minIndent <= indent) continue;
            minIndent = indent;
            minLine = p;
        }
        if (minLine == null) minLine = min;
        var max = Math.min(editor.session.getLength() - 1, end.line + 20);
        if (minIndent == null || minIndent == countColumn(editor.session.getLine(start.line), null, tabSize)) endLine = max;
        else
            for (endLine = end.line + 1; endLine < max; ++endLine) {
                var indent = countColumn(editor.session.getLine(endLine), null, tabSize);
                if (indent <= minIndent) break;
            }
        var from = Pos(minLine, 0);

        return {
            type: "part",
            name: data.name,
            offsetLines: from.line,
            text: editor.session.getTextRange({
                start: toAceLoc(from),
                end: toAceLoc(Pos(endLine, 0))
            })
        };
    }
    function countColumn(string, end, tabSize, startIndex, startValue) {
        if (end == null) {
            end = string.search(/[^\s\u00a0]/);
            if (end == -1) end = string.length;
        }
        for (var i = startIndex || 0, n = startValue || 0; i < end; ++i) {
            if (string.charAt(i) == "\t") n += tabSize - (n % tabSize);
            else ++n;
        }
        return n;
    }
    function docValue(ts, doc) {
        var val = doc.doc.getValue();
        if (ts.options.fileFilter) val = ts.options.fileFilter(val, doc.name, doc.doc);
        return val;
    }
    function typeToIcon(type) {
        var suffix;
        if (type == "?") suffix = "unknown";
        else if (type == "number" || type == "string" || type == "bool") suffix = type;
        else if (/^fn\(/.test(type)) suffix = "fn";
        else if (/^\[/.test(type)) suffix = "array";
        else suffix = "object";
        return cls + "completion " + cls + "completion-" + suffix;
    }
    var popupSelectBound = false;
    function getCompletions(ts, editor, session, pos, prefix, callback) {
        var groupName = '';
        if (debugCompletions) {
            groupName = Math.random().toString(36).slice(2);
            console.group(groupName);
            console.time('get completions from tern server');
        }
        ts.request(editor, {
                type: "completions",
                types: true,
                origins: true,
                docs: true,
                filter: false,
                omitObjectPrototype: false,
                sort: false,
                includeKeywords: true,
                guess: true,
                expandWordForward: true
            },

            function(error, data) {
                if (debugCompletions) console.timeEnd('get completions from tern server');
                if (error) {
                    return showError(ts, editor, error);
                }
                
                var ternCompletions = data.completions.map(function(item) {
                    return {
                        iconClass: " " + (item.guess ? cls + "guess" : typeToIcon(item.type)),
                        doc: item.doc,
                        type: item.type,
                        caption: item.name,
                        value: item.name,
                        score: 99999,
                        meta: item.origin ? item.origin.replace(/^.*[\\\/]/, '') : "tern"
                    };
                });
                if (debugCompletions) console.time('get and merge other completions');

                var otherCompletions = [];
                if (editor.getOption('enableBasicAutocompletion') === true) {
                    try {
                        otherCompletions = editor.session.$mode.getCompletions();
                    }
                    catch (ex) {}
                }

                if (ternCompletions.length === 0 && ts.aceTextCompletor) {
                    if (debugCompletions) console.time('aceTextCompletor');
                    var textCompletions = [];
                    try {
                        ts.aceTextCompletor.getCompletions(editor, session, pos, prefix, function(error, data) {
                            textCompletions = data.map(function(item) {
                                return {
                                    doc: item.doc,
                                    type: item.type,
                                    caption: item.caption,
                                    value: item.value,
                                    meta: 'localText'
                                };
                            });
                            var otherCompletionsContains = function(value, minLength) {
                                value = value.toLowerCase().trim();
                                if (value.length < 2) {
                                    return true;
                                }
                                var isDupe = false;
                                for (var i = 0; i < otherCompletions.length; i++) {
                                    if (otherCompletions[i].value.toString().toLowerCase() == value) {
                                        isDupe = true;
                                        break;
                                    }
                                }
                                return isDupe;
                            };
                            for (var z = 0; z < textCompletions.length; z++) {
                                var item = textCompletions[z];
                                if (otherCompletionsContains(item.value)) {
                                    continue;
                                }
                                otherCompletions.push(item);
                            }
                        });
                    }
                    catch (ex) {
                        showError(ts, editor, {
                            msg: 'ace text completor error',
                            err: ex
                        });
                    }
                    if (debugCompletions) console.timeEnd('aceTextCompletor');
                }
                if (otherCompletions.length > 0) {
                    var mergedCompletions = ternCompletions.slice(); //copy array
                    for (var n = 0; n < otherCompletions.length; n++) {
                        var b = otherCompletions[n];
                        var isDuplicate = false;
                        for (var i = 0; i < ternCompletions.length; i++) {
                            if (ternCompletions[i].value.toString() === b.value.toString()) {
                                isDuplicate = true;
                                break;
                            }
                        }
                        if (!isDuplicate) {
                            mergedCompletions.push(b);
                        }
                    }
                    ternCompletions = mergedCompletions.slice();
                }
                if (debugCompletions) console.timeEnd('get and merge other completions');
                callback(null, ternCompletions);

                if (debugCompletions) console.groupEnd(groupName);

                var tooltip = null;

                if (!bindPopupSelect()) {
                    popupSelectionChanged(); //call once if popupselect bound exited to show tooltip for first item
                }

                function bindPopupSelect() {
                    if (popupSelectBound) {
                        return false;
                    }
                    if (!editor.completer.popup) { //popup not opened yet
                        setTimeout(bindPopupSelect, 100); //try again in 100ms
                        return;
                    }
                    editor.completer.popup.on('select', popupSelectionChanged);
                    editor.completer.popup.on('hide', function() {
                        closeAllTips();
                    });
                    popupSelectionChanged(); //fire once after first bind
                    popupSelectBound = true; //prevent rebinding
                }

                function popupSelectionChanged() {
                    closeAllTips(); //remove(tooltip); //using close all , but its slower, comeback and remove single if its working right
                    var data = editor.completer.popup.getData(editor.completer.popup.getRow());
                    if (!data || !data.doc) { //no comments
                        return;
                    }
                    var node = editor.completer.popup.renderer.getContainerElement();
                    tooltip = makeTooltip(node.getBoundingClientRect().right + window.pageXOffset, node.getBoundingClientRect().top + window.pageYOffset, createInfoDataTip(data, true), editor);
                    tooltip.className += " " + cls + "hint-doc";
                }

            });
    }
        function showType(ts, editor, pos, calledFromCursorActivity) {
        if (calledFromCursorActivity) { //check if currently in call, if so, then exit
            if (editor.completer && editor.completer.popup && editor.completer.popup.isOpen) return;
            if (!isOnFunctionCall(editor)) return;
        }
        else { //run this check here if not from cursor as this is run in isOnFunctionCall() above if from cursor
            if (!inJavascriptMode(editor)) {
                return;
            }
        }
        var cb = function (error, data, typeData) {
            var tip = '';
            if (error) {
                if (calledFromCursorActivity) {
                    return;
                }
                return showError(ts, editor, error);
            }
            if (ts.options.typeTip) { //dont know when this is ever entered... was in code mirror plugin...
                tip = ts.options.typeTip(data);
            }
            else {
                if (calledFromCursorActivity) {
                    if (data.hasOwnProperty('guess') && data.guess === true) return; //dont show guesses on auto activity as they are not accurate
                    if (data.type == "?" || data.type == "string" || data.type == "number" || data.type == "bool" || data.type == "date" || data.type == "fn(document: ?)" || data.type == "fn()") {
                        return;
                    }
                }

                if (data.hasOwnProperty('type')) { //type query (first try)
                    if (data.type == "?") {
                        tip = tempTooltip(editor, elFromString('<span>?</span>'), 1000);
                        return;
                    }
                    if (data.type.toString().length > 1 && data.type.toString().substr(0, 2) !== 'fn') {
                        var innerCB = function (error, definitionData) {
                            cb(error, definitionData, data);
                        };
                        ts.request(editor, "definition", innerCB, pos, false, null);
                        return;
                    }
                }
                else { //data is a definition request
                    if (typeData && typeData.hasOwnProperty('type')) {
                        data.type = typeData.type;
                        data.name = typeData.name;
                        data.exprName = typeData.exprName;
                    }
                }
            }
            tip = createInfoDataTip(data, true);
            setTimeout(function () {
                var place = getCusorPosForTooltip(editor);
                makeTooltip(place.left, place.top, tip, editor, true); //tempTooltip(editor, tip, -1); - was temp tooltip.. TODO: add temptooltip fn
            }, 10);
        };

        ts.request(editor, "type", cb, pos, !calledFromCursorActivity);
    }
    function createInfoDataTip(data, includeType, activeArg) {
        var tip = elt("span", null);

        var d = data.doc;
        var params = data.params || parseJsDocParams(d); //parse params

        if (includeType) {
            var fnArgs = data.fnArgs ? data.fnArgs : data.type ? parseFnType(data.type) : null; //will be null if parseFnType detects that this is not a function
            if (fnArgs) {
                var getParam = function (arg, getChildren) {
                    if (params === null) return null;
                    if (!arg.name) return null;
                    var children = [];
                    for (var i = 0; i < params.length; i++) {
                        if (getChildren === true) {
                            if (params[i].parentName.toLowerCase().trim() === arg.name.toLowerCase().trim()) {
                                children.push(params[i]);
                            }
                        }
                        else {
                            if (params[i].name.toLowerCase().trim() === arg.name.toLowerCase().trim()) {
                                return params[i];
                            }
                        }
                    }
                    if (getChildren === true) return children;
                    return null;
                };
                var getParamDetailedName = function (param) {
                    var name = param.name;
                    if (param.optional === true) {
                        if (param.defaultValue) {
                            name = "[" + name + "=" + param.defaultValue + "]";
                        }
                        else {
                            name = "[" + name + "]";
                        }
                    }
                    return name;
                };
                var useDetailedArgHints = params.length === 0 || !isNaN(parseInt(activeArg));
                var typeStr = '';
                typeStr += htmlEncode(data.exprName || data.name || "fn");
                typeStr += "(";
                var activeParam = null,
                    activeParamChildren = []; //one ore more child params for multiple object properties

                for (var i = 0; i < fnArgs.args.length; i++) {
                    var paramStr = '';
                    var isCurrent = !isNaN(parseInt(activeArg)) ? i === activeArg : false;
                    var arg = fnArgs.args[i]; //name,type
                    var name = arg.name || "?";
                    if (name.length > 1 && name.substr(name.length - 1) === '?') {
                        name = name.substr(0, name.length - 1);
                        arg.name = name; //update the arg var with proper name for use below
                    }

                    if (!useDetailedArgHints) {
                        paramStr += htmlEncode(name);
                    }
                    else {
                        var param = getParam(arg, false);
                        var children = getParam(arg, true);
                        var type = arg.type;
                        var optional = false;
                        var defaultValue = '';
                        if (param !== null) {
                            name = param.name;
                            if (param.type) {
                                type = param.type;
                            }
                            if (isCurrent) {
                                activeParam = param;
                            }
                            optional = param.optional;
                            defaultValue = param.defaultValue.trim();
                        }
                        if (children && children.length > 0) {
                            if (isCurrent) {
                                activeParamChildren = children;
                            }
                            type = "{";
                            for (var c = 0; c < children.length; c++) {
                                type += children[c].name;
                                if (c + 1 !== children.length && children.length > 1) type += ", ";
                            }
                            type += "}";
                        }
                        paramStr += type ? '<span class="' + cls + 'type">' + htmlEncode(type) + '</span> ' : '';
                        paramStr += '<span class="' + cls + (isCurrent ? "farg-current" : "farg") + '">' + (htmlEncode(name) || "?") + '</span>';
                        if (defaultValue !== '') {
                            paramStr += '<span class="' + cls + 'jsdoc-param-defaultValue">=' + htmlEncode(defaultValue) + '</span>';
                        }
                        if (optional) {
                            paramStr = '<span class="' + cls + 'jsdoc-param-optionalWrapper">' + '<span class="' + cls + 'farg-optionalBracket">[</span>' + paramStr + '<span class="' + cls + 'jsdoc-param-optionalBracket">]</span>' + '</span>';
                        }
                    }
                    if (i > 0) paramStr = ', ' + paramStr;
                    typeStr += paramStr;
                }

                typeStr += ")";
                if (fnArgs.rettype) {
                    if (useDetailedArgHints) {
                        typeStr += ' -> <span class="' + cls + 'type">' + htmlEncode(fnArgs.rettype) + '</span>';
                    }
                    else {
                        typeStr += ' -> ' + htmlEncode(fnArgs.rettype);
                    }
                }
                typeStr = '<span class="' + cls + (useDetailedArgHints ? "typeHeader" : "typeHeader-simple") + '">' + typeStr + '</span>'; //outer wrapper
                if (useDetailedArgHints) {
                    if (activeParam && activeParam.description) {
                        typeStr += '<div class="' + cls + 'farg-current-description"><span class="' + cls + 'farg-current-name">' + activeParam.name + ': </span>' + activeParam.description + '</div>';
                    }
                    if (activeParamChildren && activeParamChildren.length > 0) {
                        for (var i = 0; i < activeParamChildren.length; i++) {
                            var t = activeParamChildren[i].type ? '<span class="' + cls + 'type">{' + activeParamChildren[i].type + '} </span>' : '';
                            typeStr += '<div class="' + cls + 'farg-current-description">' + t + '<span class="' + cls + 'farg-current-name">' + getParamDetailedName(activeParamChildren[i]) + ': </span>' + activeParamChildren[i].description + '</div>';
                        }
                    }
                }
                tip.appendChild(elFromString(typeStr));
            }
        }
        if (isNaN(parseInt(activeArg))) {
            if (data.doc) {
                var replaceParams = function (str, params) {
                    if (params.length === 0) {
                        return str;
                    }
                    str = str.replace(/@param/gi, '@param'); //make sure all param tags are lowercase
                    var beforeParams = str.substr(0, str.indexOf('@param'));
                    while (str.indexOf('@param') !== -1) {
                        str = str.substring(str.indexOf('@param') + 6); //starting after first param match
                    }
                    if (str.indexOf('@') !== -1) {
                        str = str.substr(str.indexOf('@')); //start at next tag that is not a param
                    }
                    else {
                        str = ''; //@param was likely the last tag, trim remaining as its likely the end of a param description
                    }
                    var paramStr = '';
                    for (var i = 0; i < params.length; i++) {
                        paramStr += '<div>';
                        if (params[i].parentName.trim() === '') {
                            paramStr += ' <span class="' + cls + 'jsdoc-tag">@param</span> ';
                        }
                        else {
                            paramStr += '<span class="' + cls + 'jsdoc-tag-param-child">&nbsp;</span> '; //dont show param tag for child param
                        }
                        paramStr += params[i].type.trim() === '' ? '' : '<span class="' + cls + 'type">{' + params[i].type + '}</span> ';

                        if (params[i].name.trim() !== '') {
                            var name = params[i].name.trim();
                            if (params[i].parentName.trim() !== '') {
                                name = params[i].parentName.trim() + '.' + name;
                            }
                            var pName = '<span class="' + cls + 'jsdoc-param-name">' + name + '</span>';
                            if (params[i].defaultValue.trim() !== '') {
                                pName += '<span class="' + cls + 'jsdoc-param-defaultValue">=' + params[i].defaultValue + '</span>';
                            }
                            if (params[i].optional) {
                                pName = '<span class="' + cls + 'jsdoc-param-optionalWrapper">' + '<span class="' + cls + 'farg-optionalBracket">[</span>' + pName + '<span class="' + cls + 'jsdoc-param-optionalBracket">]</span>' + '</span>';
                            }
                            paramStr += pName;
                        }
                        paramStr += params[i].description.trim() === '' ? '' : ' - <span class="' + cls + 'jsdoc-param-description">' + params[i].description + '</span>';
                        paramStr += '</div>';
                    }
                    if (paramStr !== '') {
                        str = '<span class="' + cls + 'jsdoc-param-wrapper">' + paramStr + '</span>' + str;
                    }

                    return beforeParams + str;
                };
                var highlighTags = function (str) {
                    try {
                        str = ' ' + str + ' '; //add white space for regex
                        var re = / ?@\w{1,50}\s ?/gi;
                        var m;
                        while ((m = re.exec(str)) !== null) {
                            if (m.index === re.lastIndex) {
                                re.lastIndex++;
                            }
                            str = str.replace(m[0], ' <span class="' + cls + 'jsdoc-tag">' + m[0].trim() + '</span> ');
                        }
                    }
                    catch (ex) {
                        showError(ts, editor, ex);
                    }
                    return str.trim();
                };
                var highlightTypes = function (str) {
                    str = ' ' + str + ' '; //add white space for regex
                    try {
                        var re = /\s{[^}]{1,50}}\s/g;
                        var m;
                        while ((m = re.exec(str)) !== null) {
                            if (m.index === re.lastIndex) {
                                re.lastIndex++;
                            }
                            str = str.replace(m[0], ' <span class="' + cls + 'type">' + m[0].trim() + '</span> ');
                        }
                    }
                    catch (ex) {
                        showError(ts, editor, ex);
                    }
                    return str.trim();
                };
                var createLinks = function (str) {
                    try {
                        var httpProto = 'HTTP_PROTO_PLACEHOLDER';
                        var httpsProto = 'HTTPS_PROTO_PLACEHOLDER';
                        var re = /\bhttps?:\/\/[^\s<>"`{}|\^\[\]\\]+/gi;
                        var m;
                        while ((m = re.exec(str)) !== null) {
                            if (m.index === re.lastIndex) {
                                re.lastIndex++;
                            }
                            var withoutProtocol = m[0].replace(/https/i, httpsProto).replace(/http/i, httpProto);
                            var text = m[0].replace(new RegExp('https://', 'i'), '').replace(new RegExp('http://', 'i'), '');
                            str = str.replace(m[0], '<a class="' + cls + 'tooltip-link" href="' + withoutProtocol + '" target="_blank">' + text + ' </a>');
                        }
                        str = str.replace(new RegExp(httpsProto, 'gi'), 'https').replace(new RegExp(httpProto, 'gi'), 'http');
                    }
                    catch (ex) {
                        showError(ts, editor, ex);
                    }
                    return str;
                };

                if (d.substr(0, 1) === '*') {
                    d = d.substr(1); //tern leaves this for jsDoc as they start with /**, not exactly sure why...
                }
                d = htmlEncode(d.trim());
                d = replaceParams(d, params);
                d = highlighTags(d);
                d = highlightTypes(d);
                d = createLinks(d);
                tip.appendChild(elFromString(d));
            }
            if (data.url) {
                tip.appendChild(document.createTextNode(" "));
                var link = elt("a", null, "[docs]");
                link.target = "_blank";
                link.href = data.url;
                tip.appendChild(link);
            }
            if (data.origin) {
                tip.appendChild(elt("div", null, elt("em", null, "source: " + data.origin)));
            }
        }
        return tip;
    }
    function parseJsDocParams(str) {
        if (!str) return [];
        str = str.replace(/@param/gi, '@param'); //make sure all param tags are lowercase
        var params = [];
        while (str.indexOf('@param') !== -1) {
            str = str.substring(str.indexOf('@param') + 6); //starting after first param match
            var nextTagStart = str.indexOf('@'); //split on next param (will break if @symbol inside of param, like a link... dont have to time fullproof right now)

            var paramStr = nextTagStart === -1 ? str : str.substr(0, nextTagStart);
            var thisParam = {
                name: "",
                parentName: "",
                type: "",
                description: "",
                optional: false,
                defaultValue: ""
            };
            var re = /\s{[^}]{1,50}}\s/;
            var m;
            while ((m = re.exec(paramStr)) !== null) {
                if (m.index === re.lastIndex) {
                    re.lastIndex++;
                }
                thisParam.type = m[0];
                paramStr = paramStr.replace(thisParam.type, '').trim(); //remove type from param string
                thisParam.type = thisParam.type.replace('{', '').replace('}', '').replace(' ', '').trim(); //remove brackets and spaces
            }
            paramStr = paramStr.trim(); //we now have a single param string starting after the type, next string should be the parameter name
            if (paramStr.substr(0, 1) === '[') {
                thisParam.optional = true;
                var endBracketIdx = paramStr.indexOf(']');
                if (endBracketIdx === -1) {
                    showError('failed to parse parameter name; Found starting \'[\' but missing closing \']\'');
                    continue; //go to next
                }
                var nameStr = paramStr.substring(0, endBracketIdx + 1);
                paramStr = paramStr.replace(nameStr, '').trim(); //remove name portion from param str
                nameStr = nameStr.replace('[', '').replace(']', ''); //remove brackets
                if (nameStr.indexOf('=') !== -1) {
                    var defaultValue = nameStr.substr(nameStr.indexOf('=') + 1);
                    if (defaultValue.trim() === '') {
                        thisParam.defaultValue = "undefined";
                    }
                    else {
                        thisParam.defaultValue = defaultValue.trim();
                    }
                    thisParam.name = nameStr.substring(0, nameStr.indexOf('=')).trim(); //set name
                }
                else {
                    thisParam.name = nameStr.trim();
                }
            }
            else { //not optional
                var nextSpace = paramStr.indexOf(' ');
                if (nextSpace !== -1) {
                    thisParam.name = paramStr.substr(0, nextSpace);
                    paramStr = paramStr.substr(nextSpace).trim(); //remove name portion from param str
                }
                else { //no more spaces left, next portion of string must be name and there is no description
                    thisParam.name = paramStr;
                    paramStr = '';
                }
            }
            var nameDotIdx = thisParam.name.indexOf('.');
            if (nameDotIdx !== -1) {
                thisParam.parentName = thisParam.name.substring(0, nameDotIdx);
                thisParam.name = thisParam.name.substring(nameDotIdx + 1);
            }
            paramStr = paramStr.trim();
            if (paramStr.length > 0) {
                thisParam.description = paramStr.replace('-', '').trim(); //optional hiphen specified before start of description
            }
            thisParam.name = htmlEncode(thisParam.name);
            thisParam.parentName = htmlEncode(thisParam.parentName);
            thisParam.description = htmlEncode(thisParam.description);
            thisParam.type = htmlEncode(thisParam.type);
            thisParam.defaultValue = htmlEncode(thisParam.defaultValue);
            params.push(thisParam);
        }
        return params;
    }
    function findRefs(ts, editor, cb) {
        if (!inJavascriptMode(editor)) {
            return;
        }
        ts.request(editor, {
            type: "refs",
            fullDocs: true
        }, function (error, data) {
            if (error) return showError(ts, editor, error);
            if (typeof cb === "function") {
                cb(data);
                return;
            }
            closeAllTips();

            var header = document.createElement("div");
            var title = document.createElement("span");
            title.textContent = data.name + '(' + data.type + ')';
            title.setAttribute("style", "font-weight:bold;");
            header.appendChild(title);

            var tip = makeTooltip(null, null, header, editor, false, -1);
            if (!data.refs || data.refs.length === 0) {
                tip.appendChild(elt('div', '', 'No References Found'));
                return;
            }
            var totalRefs = document.createElement("div");
            totalRefs.setAttribute("style", "font-style:italic; margin-bottom:3px; cursor:help");
            totalRefs.innerHTML = data.refs.length + " References Found";
            totalRefs.setAttribute('title', 'Use up and down arrow keys to navigate between references. \n\nPress Esc while focused on the list to close the popup (or use the close button in the top right corner).\n\n This is not guaranteed to find references in other files or references for non-private variables.');
            header.appendChild(totalRefs);
            var refInput = document.createElement("select");
            refInput.setAttribute("multiple", "multiple");
            refInput.addEventListener("change", function () {
                var doc = findDoc(ts, editor); //get current doc in editor
                var el = this,
                    selected;
                for (var i = 0; i < el.options.length; i++) {
                    if (selected) {
                        el[i].selected = false;
                        continue;
                    }
                    if (el[i].selected) {
                        selected = el[i];
                        selected.style.color = "grey";
                    }
                }
                var file = selected.getAttribute("data-file");
                var start = {
                    "line": selected.getAttribute("data-line"),
                    "ch": selected.getAttribute("data-ch")
                };
                var updatePosDelay = 300;
                var targetDoc = {
                    name: file
                };
                if (doc.name == file) {
                    targetDoc = doc; //current doc
                    updatePosDelay = 50;
                }
                var animatedScroll = editor.getAnimatedScroll();
                if (animatedScroll) {
                    editor.setAnimatedScroll(false);
                }

                moveTo(ts, doc, targetDoc, start, null, true);
                setTimeout(function () {
                    moveTooltip(tip, null, null, editor);
                    closeAllTips(tip); //close any tips that moving this might open, except for the ref tip
                    if (animatedScroll) {
                        editor.setAnimatedScroll(true); //re-enable
                    }
                }, updatePosDelay);
            });
            var addRefLine = function (file, start) {
                var el = document.createElement("option");
                el.setAttribute("data-file", file);
                el.setAttribute("data-line", start.line);
                el.setAttribute("data-ch", start.ch);
                el.text = (start.line + 1) + ":" + start.ch + " - " + file; //add 1 to line because editor does not use line 0
                refInput.appendChild(el);
            };
            var finalizeRefInput = function () {
                var height = (refInput.options.length * 15);
                height = height > 175 ? 175 : height;
                refInput.style.height = height + "px";
                tip.appendChild(refInput);
                refInput.focus(); //focus on the input (user can press down key to start traversing refs)
                refInput.addEventListener('keydown', function (e) {
                    if (e && e.keyCode && e.keyCode == 27) {
                        remove(tip);
                    }
                });
            };

            for (var i = 0; i < data.refs.length; i++) {
                var tmp = data.refs[i];
                try {
                    addRefLine(tmp.file, tmp.start);
                    if (i === data.refs.length - 1) {
                        finalizeRefInput();
                    }
                }
                catch (ex) {
                    console.log('findRefs inner loop error (should not happen)', ex);
                }
            }
        });
    }
    function rename(ts, editor) {

        findRefs(ts, editor, function (r) {
            if (!r || r.refs.length === 0) {
                showError(ts, editor, "Cannot rename as no references were found for this variable");
                return;
            }
            var executeRename = function (newName) {
                ts.request(editor, {
                    type: "rename",
                    newName: newName,
                    fullDocs: true
                }, function (error, data) {
                    if (error) return showError(ts, editor, error);
                    applyChanges(ts, data.changes, function (result) {
                        var resultTip = makeTooltip(null, null, elt("div", "", "Replaced " + result.replaced + " references sucessfully"), editor, true);
                        var errors = elt("div", "");
                        errors.setAttribute("style", "color:red");
                        if (result.replaced != r.refs.length) {
                            errors.textContent = " WARNING! original refs: " + r.refs.length + ", replaced refs: " + result.replaced;
                        }
                        if (result.errors !== "") {
                            errors.textContent += " \n Errors encountered:" + result.errors;
                        }
                        if (errors.textContent !== "") {
                            resultTip.appendChild(errors);
                        }
                    });
                });
            };
            
            var tip = makeTooltip(null, null, elt("div", "", r.name + ": " + r.refs.length + " references found \n (WARNING: this wont work for refs in another file!) \n\n Enter new name:\n"), editor, true);
            var newNameInput = elt('input');
            tip.appendChild(newNameInput);
            try {
                setTimeout(function () {
                    newNameInput.focus();
                }, 100);
            }
            catch (ex) {}

            var goBtn = elt('button', '');
            goBtn.textContent = "Rename";
            goBtn.setAttribute("type", "button");
            goBtn.addEventListener('click', function () {
                remove(tip);
                var newName = newNameInput.value;
                if (!newName || newName.trim().length === 0) {
                    showError(ts, editor, "new name cannot be empty");
                    return;
                }

                executeRename(newName);
            });
            tip.appendChild(goBtn);
        });
    }
    var nextChangeOrig = 0;
    function applyChanges(ts, changes, cb) {
        var Range = ace.require("ace/range").Range; //for ace
        var perFile = Object.create(null);
        for (var i = 0; i < changes.length; ++i) {
            var ch = changes[i];
            (perFile[ch.file] || (perFile[ch.file] = [])).push(ch);
        }
        var result = {
            replaced: 0,
            status: "",
            errors: ""
        };

        for (var file in perFile) {
            var known = ts.docs[file],
                chs = perFile[file];
            if (!known) continue;
            chs.sort(function (a, b) {
                return cmpPos(b.start, a.start);
            });
            var origin = "*rename" + (++nextChangeOrig);
            for (var i = 0; i < chs.length; ++i) {
                try {
                    var ch = chs[i];
                    ch.start = toAceLoc(ch.start);
                    ch.end = toAceLoc(ch.end);
                    known.doc.session.replace(new Range(ch.start.row, ch.start.column, ch.end.row, ch.end.column), ch.text);
                    result.replaced++;
                }
                catch (ex) {
                    result.errors += '\n ' + file + ' - ' + ex.toString();
                    console.log('error applying rename changes', ex);
                }
            }
        }
        if (typeof cb === "function") {
            cb(result);
        }
    }
    function isOnFunctionCall(editor) {
        if (!inJavascriptMode(editor)) return false;
        if (somethingIsSelected(editor)) return false;
        if (isInCall(editor)) return false;

        var tok = getCurrentToken(editor);
        if (!tok) return; //No token at current location
        if (!tok.start) return; //sometimes this is missing... not sure why but makes it impossible to do what we want
        if (tok.type.indexOf('entity.name.function') !== -1) return false; //function definition
        if (tok.type.indexOf('storage.type') !== -1) return false; // could be 'function', which is start of an anon fn
        var nextTok = editor.session.getTokenAt(editor.getSelectionRange().end.row, (tok.start + tok.value.length + 1));
        if (!nextTok || nextTok.value !== "(") return false;

        return true;
    }
    function somethingIsSelected(editor) {
        return editor.getSession().getTextRange(editor.getSelectionRange()) !== '';
    }
    function getCusorPosForTooltip(editor) {
        var place = editor.renderer.$cursorLayer.getPixelPosition(); //this gets left correclty, but not top if there is scrolling
        place.top = editor.renderer.$cursorLayer.cursors[0].offsetTop; //this gets top correctly regardless of scrolling, but left is not correct
        place.top += editor.renderer.scroller.getBoundingClientRect().top; //top offset of editor on page
        place.left += editor.renderer.container.offsetLeft;
        console.log(place);
        return {
            left: place.left + 45,
            top: place.top + 17
        };
        
    }
    function getCurrentToken(editor) {
        try {
            var pos = editor.getSelectionRange().end;
            return editor.session.getTokenAt(pos.row, pos.column);
        }
        catch (ex) {
            showError(ts, editor, ex);
        }
    }
    function getCallPos(editor, pos) {
        if (somethingIsSelected(editor)) return;
        if (!inJavascriptMode(editor)) return;
        var start = {}; //start of query to tern (start of the call location)
        var currentPosistion = pos || editor.getSelectionRange().start; //{row,column}
        currentPosistion = toAceLoc(currentPosistion); //just in case
        var currentLine = currentPosistion.row;
        var currentCol = currentPosistion.column;
        var firstLineToCheck = Math.max(0, currentLine - 6);
        var ch = '';
        var depth = 0;
        var commas = [];
        for (var row = currentLine; row >= firstLineToCheck; row--) {
            var thisRow = editor.session.getLine(row);
            if (row === currentLine) {
                thisRow = thisRow.substr(0, currentCol);
            }
            for (var col = thisRow.length; col >= 0; col--) {
                ch = thisRow.substr(col, 1);
                if (ch === '}' || ch === ')' || ch === ']') {
                    depth += 1;
                }
                else if (ch === '{' || ch === '(' || ch === '[') {
                    if (depth > 0) {
                        depth -= 1;
                    }
                    else if (ch === '(') {
                        var debugFnCall = false;
                        var upToParen = thisRow.substr(0, col);
                        if (!upToParen.length) {
                            if (debugFnCall) console.log('not fn call because before parent is empty');
                            break;
                        }
                        if (upToParen.substr(upToParen.length - 1) === ' ') {
                            if (debugFnCall) console.log('not fn call because there is a space before paren');
                            break;
                        }
                        var wordBeforeFnName = upToParen.split(' ').reverse()[1];
                        if (wordBeforeFnName && wordBeforeFnName.toLowerCase() === 'function') {
                            if (debugFnCall) console.log('not fn call because this is a function declaration');
                            break;
                        }
                        var token = editor.session.getTokenAt(row, col);
                        if (token) {
                            if (token.type.toString().indexOf('comment') !== -1 || token.type === 'keyword' || token.type === 'storage.type') {
                                if (debugFnCall) console.log('existing because token is comment, keyword, or storage.type (`function`)');
                                break;
                            }
                        }

                        if (debugFnCall) console.info('getting arg hints!');
                        start = {
                            line: row,
                            ch: col
                        };
                        break;
                    }
                    else {
                        break;
                    }
                }
                else if (ch === ',' && depth === 0) {
                    commas.push({
                        line: row,
                        ch: col
                    });
                }
            }

        }

        if (!start.hasOwnProperty('line')) return; //start not found
        var argpos = 0;
        for (var i = 0; i < commas.length; i++) {
            var p = commas[i];
            if ((p.line === start.line && p.ch > start.ch) || (p.line > start.line)) {
                argpos += 1;
            }
        }

        return {
            start: toTernLoc(start),
            "argpos": argpos
        };
    }
    function isInCall(editor, pos) {
        var callPos = getCallPos(editor, pos);
        if (callPos) {
            return true;
        }
        return false;
    }

    var debounce_updateArgHints = null;
    function updateArgHints(ts, editor) {
        clearTimeout(debounce_updateArgHints);
        closeArgHints(ts);
        var callPos = getCallPos(editor);
        if (!callPos) {
            return;
        }
        var start = callPos.start;
        var argpos = callPos.argpos;
        var cache = ts.cachedArgHints;
        if (cache && cache.doc == editor && cmpPos(start, cache.start) === 0) {
            return showArgHints(ts, editor, argpos);
        }
        debounce_updateArgHints = setTimeout(inner, 500);
        function inner() {
            ts.request(editor, {
                type: "type",
                preferFunction: true,
                end: start
            }, function (error, data) {
                if (error) {
                    if (error.toString().toLowerCase().indexOf('no expression at') === -1 && error.toString().toLowerCase().indexOf('no type found at') === -1) {
                        return showError(ts, editor, error);
                    }
                }
                if (error || !data.type || !(/^fn\(/).test(data.type)) {
                    return;
                }
                ts.cachedArgHints = {
                    start: start,
                    type: parseFnType(data.type),
                    name: data.exprName || data.name || "fn",
                    guess: data.guess,
                    doc: editor,
                    comments: data.doc //added by morgan- include comments with arg hints
                };
                showArgHints(ts, editor, argpos);
            });
        }
    }
    function showArgHints(ts, editor, pos) {
        closeArgHints(ts);
        var cache = ts.cachedArgHints,
            tp = cache.type,
            comments = cache.comments; //added by morgan to include document comments
        if (!cache.hasOwnProperty('params')) {
            if (!cache.comments) {
                cache.params = null;
            }
            else {
                var params = parseJsDocParams(cache.comments);
                if (!params || params.length === 0) {
                    cache.params = null;
                }
                else {
                    cache.params = params;
                }
            }
        }

        var place = getCusorPosForTooltip(editor);
        var data = {
            name: cache.name,
            guess: cache.guess,
            fnArgs: cache.type,
            doc: cache.comments,
            params: cache.params,
        };
        var tip = createInfoDataTip(data, true, pos);
        ts.activeArgHints = makeTooltip(place.left, place.top, tip, editor, true);
        return;
    }
    function parseFnType(text) {
        if (text.substring(0, 2) !== 'fn') return null; //not a function
        if (text.indexOf('(') === -1) return null;

        var args = [],
            pos = 3;

        function skipMatching(upto) {
            var depth = 0,
                start = pos;
            for (;;) {
                var next = text.charAt(pos);
                if (upto.test(next) && !depth) return text.slice(start, pos);
                if (/[{\[\(]/.test(next)) ++depth;
                else if (/[}\]\)]/.test(next)) --depth;
                ++pos;
            }
        }
        if (text.charAt(pos) != ")")
            for (;;) {
                var name = text.slice(pos).match(/^([^, \(\[\{]+): /);
                if (name) {
                    pos += name[0].length;
                    name = name[1];
                }
                args.push({
                    name: name,
                    type: skipMatching(/[\),]/)
                });
                if (text.charAt(pos) == ")") break;
                pos += 2;
            }

        var rettype = text.slice(pos).match(/^\) -> (.*)$/);
        return {
            args: args,
            rettype: rettype && rettype[1]
        };
    }
    function htmlEncode(string) {
        var entityMap = {
            "<": "&lt;",
            ">": "&gt;",
        };
        return String(string).replace(/[<>]/g, function (s) {
            if (!s) return '';
            return entityMap[s];
        });
    }
    function cmpPos(a, b) {
        a = toTernLoc(a);
        b = toTernLoc(b);
        return a.line - b.line || a.ch - b.ch;
    }
    function dialog(cm, text, f) {
        alert('need to implment dialog');
    }
    function elFromString(s) {
        var frag = document.createDocumentFragment(),
            temp = document.createElement('span');
        temp.innerHTML = s;
        while (temp.firstChild) {
            frag.appendChild(temp.firstChild);
        }
        return frag;
    }
    function elt(tagname, cls /*, ... elts*/ ) {
        var e = document.createElement(tagname);
        if (cls) e.className = cls;
        for (var i = 2; i < arguments.length; ++i) {
            var elt = arguments[i];
            if (typeof elt == "string") elt = document.createTextNode(elt);
            e.appendChild(elt);
        }
        return e;
    }
    function closeAllTips(except) {
        var tips = document.querySelectorAll('.' + cls + 'tooltip');
        if (tips.length > 0) {
            for (var i = 0; i < tips.length; i++) {
                if (except && tips[i] == except) {
                    continue;
                }
                remove(tips[i]);
            }
        }
    }
    function tempTooltip(editor, content, timeout) {
        if (!timeout) {
            timeout = 3000;
        }
        var location = getCusorPosForTooltip(editor);
        return makeTooltip(location.left, location.top, content, editor, true, timeout);
    }
    function makeTooltip(x, y, content, editor, closeOnCusorActivity, fadeOutDuration) {
        if (x === null || y === null) {
            var location = getCusorPosForTooltip(editor);
            x = location.left;
            y = location.top;
        }
        var node = elt("div", cls + "tooltip", content);
        node.style.left = x + "px";
        node.style.top = y + "px";
        document.body.appendChild(node);
        var closeBtn = document.createElement('a');
        closeBtn.setAttribute('title', 'close');
        closeBtn.setAttribute('class', cls + 'tooltip-boxclose');
        closeBtn.addEventListener('click', function () {
            remove(node);
        });
        node.appendChild(closeBtn);

        if (closeOnCusorActivity === true) {
            if (!editor) {
                throw Error('tern.makeTooltip called with closeOnCursorActivity=true but editor was not passed. Need to pass editor!');
            }
            var closeThisTip = function () {
                if (!node.parentNode) return; //not sure what this is for, its from CM
                remove(node);
                editor.getSession().selection.off('changeCursor', closeThisTip);
                editor.getSession().off('changeScrollTop', closeThisTip);
                editor.getSession().off('changeScrollLeft', closeThisTip);
            };
            editor.getSession().selection.on('changeCursor', closeThisTip);
            editor.getSession().on('changeScrollTop', closeThisTip);
            editor.getSession().on('changeScrollLeft', closeThisTip);
        }

        if (fadeOutDuration) {
            fadeOutDuration = parseInt(fadeOutDuration, 10);
            if (fadeOutDuration > 100) {
                var fadeThistip = function () {
                    if (!node.parentNode) return; //not sure what this is for, its from CM
                    fadeOut(node, fadeOutDuration);
                    try {
                        editor.getSession().selection.off('changeCursor', closeThisTip);
                        editor.getSession().off('changeScrollTop', closeThisTip);
                        editor.getSession().off('changeScrollLeft', closeThisTip);
                    }
                    catch (ex) {}
                };
                setTimeout(fadeThistip, fadeOutDuration);
            }
        }

        return node;
    }
    function moveTooltip(tip, x, y, editor) {
        if (x === null || y === null) {
            var location = getCusorPosForTooltip(editor);
            x = location.left;
            y = location.top;
        }
        tip.style.left = x + "px";
        tip.style.top = y + "px";
    }
    function remove(node) {
        var p = node && node.parentNode;
        if (p) p.removeChild(node);
    }
    function fadeOut(tooltip, timeout) {
        if (!timeout) {
            timeout = 1100;
        }
        if (timeout === -1) {
            remove(tooltip);
            return;
        }
        tooltip.style.opacity = "0";
        setTimeout(function () {
            remove(tooltip);
        }, timeout);
    }
    function showError(ts, editor, msg, noPopup) {
        try {
            var message = '',
                details = '';

            var isError = function (o) {
                return o && o.name && o.stack && o.message;
            };

            if (isError(msg)) { //msg is an Error object
                message = msg.name + ': ' + msg.message;
                details = msg.stack;
            }
            else if (msg.msg && msg.err) { //msg is object that has string msg and Error object
                message = msg.msg;
                if (isError(msg.err)) {
                    message += ': ' + msg.err.message;
                    details = msg.err.stack;
                }
            }
            else { //msg is string message;
                message = msg;
                details = 'details not supplied. current stack:\n' + new Error().stack;
            }

            console.log('ternError:\t ', message, '\n details:', details); //log the message and deatils (if any)

            if (!noPopup) { //show popup
                var el = elt('span', null, message);
                el.style.color = 'red';
                tempTooltip(editor, el);
            }
        }
        catch (ex) {
            setTimeout(function () {
                if (typeof message === undefined) {
                    message = " (no error passed)";
                }
                throw new Error('tern show error failed.' + message + '\n\n fail error: ' + ex.name + '\n' + ex.message + '\n' + ex.stack);
            }, 0);
        }
    }
    function closeArgHints(ts) {
        if (ts.activeArgHints) {
            remove(ts.activeArgHints);
            ts.activeArgHints = null;
        }
    }
    function jumpToDef(ts, editor) {
        function inner(varName) {
            var req = {
                type: "definition",
                variable: varName || null
            };
            var doc = findDoc(ts, editor);
            ts.server.request(buildRequest(ts, doc, req, null, true), function (error, data) {

                if (error) return showError(ts, editor, error);
                if (!data.file && data.url) {
                    window.open(data.url);
                    return;
                }

                if (data.file) {
                    var localDoc = ts.docs[data.file];
                    var found;
                    if (localDoc && (found = findContext(localDoc.doc, data))) {
                        ts.jumpStack.push({
                            file: doc.name,
                            start: toTernLoc(editor.getSelectionRange().start), //editor.getCursor("from"), (not sure if correct)
                            end: toTernLoc(editor.getSelectionRange().end) //editor.getCursor("to")
                        });
                        moveTo(ts, doc, localDoc, found.start, found.end);
                        return;
                    }
                    else { //not local doc- added by morgan... this still needs work as its a hack for the fact that ts.docs does not contain the file we want, instead it only contains a single file at a time. need to fix this (likely needs a big overhaul)
                        moveTo(ts, doc, {
                            name: data.file
                        }, data.start, data.end);
                        return;
                    }
                }

                showError(ts, editor, "Could not find a definition.");
            });
        }
        inner();
    }
    function moveTo(ts, curDoc, doc, start, end, doNotCloseTips) {
        end = end || start;
        if (curDoc != doc) {
            if (ts.options.switchToDoc) {
                if (!doNotCloseTips) {
                    closeAllTips();
                }
                ts.options.switchToDoc(doc.name, toAceLoc(start), toAceLoc(end));
            }
            else {
                showError(ts, curDoc.doc, 'Need to add editor.ternServer.options.switchToDoc to jump to another document');
            }
            return;
        }
        var pos = toAceLoc(start);
        curDoc.doc.gotoLine(pos.row, pos.column || 0); //this will make sure that the line is expanded
        curDoc.doc.getSession().unfold(pos); //gotoLine is supposed to unfold but its not working properly.. this ensures it gets unfolded

        var sel = curDoc.doc.getSession().getSelection();
        sel.setSelectionRange({
            start: toAceLoc(start),
            end: toAceLoc(end)
        });
    }
    function jumpBack(ts, editor) {
        var pos = ts.jumpStack.pop(),
            doc = pos && ts.docs[pos.file];
        if (!doc) return;
        moveTo(ts, findDoc(ts, editor), doc, pos.start, pos.end);
    }
    function findContext(editor, data) {
        try {
            var before = data.context.slice(0, data.contextOffset).split("\n");
            var startLine = data.start.line - (before.length - 1);
            var ch = null;
            if (before.length == 1) {
                ch = data.start.ch;
            }
            else {
                ch = editor.session.getLine(startLine).length - before[0].length;
            }
            var start = Pos(startLine, ch);

            var text = editor.session.getLine(startLine).slice(start.ch);
            for (var cur = startLine + 1; cur < editor.session.getLength() && text.length < data.context.length; ++cur) {
                text += "\n" + editor.session.getLine(cur);
            }
        }
        catch (ex) {
            console.log('ext-tern.js findContext Error; (error is caused by a doc (string) being passed to this function instead of editor due to ghetto hack from adding VS refs... need to fix eventually. should only occur when jumping to def in separate file)', ex); //,'\neditor:',editor,'\ndata:',data);
        }
        return data;
        console.log(new Error('This part is not complete, need to implement using Ace\'s search functionality'));
        var cursor = editor.getSearchCursor(data.context, 0, false);
        var nearest, nearestDist = Infinity;
        while (cursor.findNext()) {
            var from = cursor.from(),
                dist = Math.abs(from.line - start.line) * 10000;
            if (!dist) dist = Math.abs(from.ch - start.ch);
            if (dist < nearestDist) {
                nearest = from;
                nearestDist = dist;
            }
        }
        if (!nearest) return null;

        if (before.length == 1) nearest.ch += before[0].length;
        else nearest = Pos(nearest.line + (before.length - 1), before[before.length - 1].length);
        if (data.start.line == data.end.line) var end = Pos(nearest.line, nearest.ch + (data.end.ch - data.start.ch));
        else var end = Pos(nearest.line + (data.end.line - data.start.line), data.end.ch);
        return {
            start: nearest,
            end: end
        };
    }
    function atInterestingExpression(editor) {
        var pos = editor.getSelectionRange().end; //editor.getCursor("end"),
        var tok = editor.session.getTokenAt(pos.row, pos.column); // editor.getTokenAt(pos);
        if (tok.start < pos.column && (tok.type == "comment" || tok.type == "string")) {
            return false;
        }
        return true;///\w/.test(editor.session.getLine(pos.line).slice(Math.max(pos. - 1, 0), pos.ch + 1));
    }
    function sendDoc(ts, doc) {
        ts.server.request({
            files: [{
                type: "full",
                name: doc.name,
                text: docValue(ts, doc)
            }]
        }, function (error) {
            if (error) console.error(error);
            else doc.changed = null;
        });
    }
    function inJavascriptMode(editor) {
        return getCurrentMode(editor) == 'javascript';
    }
    function getCurrentMode(editor) {
        var scope = editor.session.$mode.$id || "";
        scope = scope.split("/").pop();
        if (scope === "html" || scope === "php") {
            if (scope === "php") scope = "html";
            var c = editor.getCursorPosition();
            var state = editor.session.getState(c.row);
            if (typeof state === "object") {
                state = state[0];
            }
            if (state.substring) {
                if (state.substring(0, 3) == "js-") scope = "javascript";
                else if (state.substring(0, 4) == "css-") scope = "css";
                else if (state.substring(0, 4) == "php-") scope = "php";
            }
        }
        return scope;
    }
    function startsWith(str, token) {
        return str.slice(0, token.length).toUpperCase() == token.toUpperCase();
    }
    function trackChange(ts, doc, change) {
        var _change = {};
        _change.from = toTernLoc(change.start);
        _change.to = toTernLoc(change.end);
        _change.text = change.lines;

        var data = findDoc(ts, doc);
        var argHints = ts.cachedArgHints;

        if (argHints && argHints.doc == doc && cmpPos(argHints.start, _change.to) <= 0) {
            ts.cachedArgHints = null;
        }

        var changed = data.changed; //data is the tern server doc, which keeps a changed property, which is null here
        if (changed === null) {
            data.changed = changed = {
                from: _change.from.line,
                to: _change.from.line
            };
        }

        var end = _change.from.line + (_change.text.length - 1);
        if (_change.from.line < changed.to) {
            changed.to = changed.to - (_change.to.line - end);
        }
        if (end >= changed.to) {
            changed.to = end + 1;
        }
        if (changed.from > _change.from.line) {
            changed.from = changed.from.line;
        }
        if (doc.session.getLength() > bigDoc && _change.to - changed.from > 100) {
            setTimeout(function () {
                if (data.changed && data.changed.to - data.changed.from > 100) {
                    sendDoc(ts, data);
                }
            }, 200);
        }
    }
    function loadExplicitVsRefs(ts, editor) {
        if (!editor.ternServer || !editor.ternServer.enabledAtCurrentLocation(editor)) {
            return;
        }
        var isBrowser = window && window.location && window.location.toString().toLowerCase().indexOf('http') === 0;

        var StringtoCheck = "";
        for (var i = 0; i < editor.session.getLength(); i++) {
            var thisLine = editor.session.getLine(i);
            if (thisLine.substr(0, 3) === "///") {
                StringtoCheck += "\n" + thisLine;
            }
            else {
                break; //only top lines may be references
            }
        }
        if (StringtoCheck === '') {
            return;
        }

        var re = /(?!\/\/\/\s*?<reference path=")[^"]*/g;
        var m;
        var refs = [];
        while ((m = re.exec(StringtoCheck)) != null) {
            if (m.index === re.lastIndex) {
                re.lastIndex++;
            }
            var r = m[0].replace('"', '');
            if (r.toLowerCase().indexOf('reference path') === -1 && r.trim() !== '' && r.toLowerCase().indexOf('/>') === -1) {
                if (r.toLowerCase().indexOf('vsdoc') === -1) { //dont load vs doc files as they are visual studio xml junk
                    refs.push(r);
                }
            }
        }
        var resultMsgEl = document.createElement('span'),
            addFileDoneCount = 0,
            addFileDoneCountCompleted = 0;
        var addFileDone = function (msg, isErr) {
            addFileDoneCountCompleted++;
        
            var el = document.createElement('div');
            el.setAttribute('style', 'font-size:smaller; font-style:italic; color:' + (isErr ? 'red' : 'gray'));
            el.textContent = msg;
        
            resultMsgEl.appendChild(el);
        
            if (addFileDoneCount == addFileDoneCountCompleted) {
                tempTooltip(editor, resultMsgEl);
            }
        };
        var ReadFile_AddToTern = function (path) {
            try {
                var isFullUrl = path.toLowerCase().indexOf("http") === 0;
                if (isFullUrl || isBrowser) {
                    addFileDoneCount++;
                    var xhr = new XMLHttpRequest();
                    xhr.open("get", path, true);
                    xhr.send();
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState == 4) {
                            if (xhr.status == 200) {
                                console.log('adding web reference: ' + path);
                                addFileDone('adding web reference: ' + path);
                                editor.ternServer.addDoc(path, xhr.responseText);
                            }
                            else {
                                if (xhr.status == 404) { //not found
                                    console.log('error adding web reference (not found): ' + path, xhr);
                                    addFileDone('error adding web reference (not found): ' + path, true);
                                }
                                else {
                                    console.log('error adding web reference (unknown error, see xhr): ' + path, xhr);
                                    addFileDone('error adding web reference (unknown error, see console): ' + path, true);
                                }
                            }
                        }
                    };
                }
                else { //local
                    addFileDoneCount++;
                    resolveFilePath(ts, path, function (resolvedPath) {
                        getFile(ts, resolvedPath, function (err, data) {
                            if (err || !data) {
                                console.log('error getting file: ' + resolvedPath, err);
                                addFileDone('error getting file: ' + resolvedPath + '(see console for details)', true);
                            }
                            else {
                                ts.addDoc(resolvedPath, data.toString());
                                console.log('adding reference: ' + resolvedPath);
                                addFileDone('adding reference: ' + resolvedPath);
                            }
                        });
                    });
                }
            }
            catch (ex) {
                console.log('add to tern error; path=' + path);
                throw ex;
            }
        };

        for (var i = 0; i < refs.length; i++) {
            var thisPath = refs[i];
            ReadFile_AddToTern(thisPath);
        }
    }
    function WorkerServer(ts, workerClass) {
        var worker = workerClass ? new workerClass() : new Worker(ts.options.workerScript);
        var startServer = function (ts) {
            worker.postMessage({
                type: "init",
                defs: ts.options.defs,
                plugins: ts.options.plugins,
                scripts: ts.options.workerDeps
            });
        };

        startServer(ts); //start

        var msgId = 0,
            pending = {};

        function send(data, c) {
            if (c) {
                data.id = ++msgId;
                pending[msgId] = c;
            }
            worker.postMessage(data);
        }
        worker.onmessage = function (e) {
            var data = e.data;
            if (data.type == "getFile") {
                getFile(ts, data.name, function (err, text) {
                    send({
                        type: "getFile",
                        err: String(err),
                        text: text,
                        id: data.id
                    });
                });
            }
            else if (data.type == "debug") {
                console.log('(worker debug) ', data.message);
            }
            else if (data.id && pending[data.id]) {
                pending[data.id](data.err, data.body);
                delete pending[data.id];
            }
        };
        worker.onerror = function (e) {
            for (var id in pending) pending[id](e);
            pending = {};
        };

        this.addFile = function (name, text) {
            send({
                type: "add",
                name: name,
                text: text
            });
        };
        this.delFile = function (name) {
            send({
                type: "del",
                name: name
            });
        };
        this.request = function (body, c) {
            send({
                type: "req",
                body: body
            }, c);
        };
        this.setDefs = function (arr_defs) {
            send({
                type: "setDefs",
                defs: arr_defs
            });
        };
        this.restart = function (ts) {
            startServer(ts);
        };
        this.sendDebug = function (message) {
            send({
                type: "debug",
                body: message
            });
        };
    }
    var dom = require("ace/lib/dom");
    dom.importCssString(".Ace-Tern-tooltip { border: 1px solid silver; border-radius: 3px; color: #444; padding: 2px 5px; padding-right:15px; font-size: 90%; font-family: monospace; background-color: white; white-space: pre-wrap; max-width: 50em; max-height:30em; overflow-y:auto; position: absolute; z-index: 10; -webkit-box-shadow: 2px 3px 5px rgba(0, 0, 0, .2); -moz-box-shadow: 2px 3px 5px rgba(0, 0, 0, .2); box-shadow: 2px 3px 5px rgba(0, 0, 0, .2); transition: opacity 1s; -moz-transition: opacity 1s; -webkit-transition: opacity 1s; -o-transition: opacity 1s; -ms-transition: opacity 1s; } .Ace-Tern-tooltip-boxclose { position:absolute; top:0; right:3px; color:red; } .Ace-Tern-tooltip-boxclose:hover { background-color:yellow; } .Ace-Tern-tooltip-boxclose:before { content:'×'; cursor:pointer; font-weight:bold; font-size:larger; } .Ace-Tern-completion { padding-left: 12px; position: relative; } .Ace-Tern-completion:before { position: absolute; left: 0; bottom: 0; border-radius: 50%; font-weight: bold; height: 13px; width: 13px; font-size:11px; line-height: 14px; text-align: center; color: white; -moz-box-sizing: border-box; -webkit-box-sizing: border-box; box-sizing: border-box; } .Ace-Tern-completion-unknown:before { content:'?'; background: #4bb; } .Ace-Tern-completion-object:before { content:'O'; background: #77c; } .Ace-Tern-completion-fn:before { content:'F'; background: #7c7; } .Ace-Tern-completion-array:before { content:'A'; background: #c66; } .Ace-Tern-completion-number:before { content:'1'; background: #999; } .Ace-Tern-completion-string:before { content:'S'; background: #999; } .Ace-Tern-completion-bool:before { content:'B'; background: #999; } .Ace-Tern-completion-guess { color: #999; } .Ace-Tern-hint-doc { max-width: 35em; } .Ace-Tern-fhint-guess { opacity: .7; } .Ace-Tern-fname { color: black; } .Ace-Tern-farg { color: #70a; } .Ace-Tern-farg-current { color: #70a; font-weight:bold; font-size:larger; text-decoration:underline; } .Ace-Tern-farg-current-description { font-style:italic; margin-top:2px; color:black; } .Ace-Tern-farg-current-name { font-weight:bold; } .Ace-Tern-type { color: #07c; font-size:smaller; } .Ace-Tern-jsdoc-tag { color: #B93A38; text-transform: lowercase; font-size:smaller; font-weight:600; } .Ace-Tern-jsdoc-param-wrapper{ /*background-color: #FFFFE3; padding:3px;*/ } .Ace-Tern-jsdoc-tag-param-child{ display:inline-block; width:0px; } .Ace-Tern-jsdoc-param-optionalWrapper { font-style:italic; } .Ace-Tern-jsdoc-param-optionalBracket { color:grey; font-weight:bold; } .Ace-Tern-jsdoc-param-name { color: #70a; font-weight:bold; } .Ace-Tern-jsdoc-param-defaultValue { color:grey; } .Ace-Tern-jsdoc-param-description { color:black; } .Ace-Tern-typeHeader-simple{ font-size:smaller; font-weight:bold; display:block; font-style:italic; margin-bottom:3px; color:grey; } .Ace-Tern-typeHeader{ display:block; font-style:italic; margin-bottom:3px; } .Ace-Tern-tooltip-link{font-size:smaller; color:blue;} .ace_autocomplete {width: 400px ;}", "ace_tern");

});

ace.define("ace/tern/tern",["require","exports","module","ace/config","ace/lib/lang","ace/snippets","ace/autocomplete/text_completer","ace/autocomplete","ace/autocomplete/util","ace/tern/tern_server","ace/editor"], function(require, exports, module) {
    "use strict";
    var config = require("../config");
    var lang = require("../lib/lang");
    var util = require("../autocomplete/util");
    var snippetManager = require("../snippets").snippetManager;
    var snippetCompleter = {
        getCompletions: function(editor, session, pos, prefix, callback) {
            var snippetMap = snippetManager.snippetMap;
            var completions = [];
            snippetManager.getActiveScopes(editor).forEach(function(scope) {
                var snippets = snippetMap[scope] || [];
                for (var i = snippets.length; i--;) {
                    var s = snippets[i];
                    var caption = s.name || s.tabTrigger;
                    if (!caption)
                        continue;
                    completions.push({
                        caption: caption,
                        snippet: s.content,
                        meta: s.tabTrigger && !s.name ? s.tabTrigger + "\u21E5 " : "snippet",
                        type: "snippet"
                    });
                }
            }, this);
            callback(null, completions);
        },
        getDocTooltip: function(item) {
            if (item.type == "snippet" && !item.docHTML) {
                item.docHTML = [
                    "<b>", lang.escapeHTML(item.caption), "</b>", "<hr></hr>",
                    lang.escapeHTML(item.snippet)
                ].join("");
            }
        }
    };
    var textCompleter = require("../autocomplete/text_completer");
    var keyWordCompleter = {
        getCompletions: function(editor, session, pos, prefix, callback) {
            if (session.$mode.completer) {
                return session.$mode.completer.getCompletions(editor, session, pos, prefix, callback);
            }
            var state = editor.session.getState(pos.row);
            var completions = session.$mode.getCompletions(state, session, pos, prefix);
            callback(null, completions);
        }
    };
    var completers = [snippetCompleter, textCompleter, keyWordCompleter];
    exports.setCompleters = function(val) {
        completers = val || [];
    };

    exports.addCompleter = function(completer) {
        completers.push(completer);
    };

    var expandSnippet = {
        name: "expandSnippet",
        exec: function(editor) {
            var success = snippetManager.expandWithTab(editor);
            if (!success) editor.execCommand("indent"); //note: not sure if this line was added by morgan and if its still relevant..
        },
        bindKey: "tab"
    };

    var loadSnippetsForMode = function(mode) {
        var id = mode.$id;
        if (!snippetManager.files)
            snippetManager.files = {};
        loadSnippetFile(id);
        if (mode.$modes) {
            for (var m in mode.$modes) {
                loadSnippetsForMode(mode.$modes[m]);
            }
        }
    };

    var loadSnippetFile = function(id) {
        if (!id || snippetManager.files[id])
            return;
        var snippetFilePath = id.replace("mode", "snippets");
        snippetManager.files[id] = {};
        config.loadModule(snippetFilePath, function(m) {
            if (m) {
                snippetManager.files[id] = m;
                if (!m.snippets && m.snippetText)
                    m.snippets = snippetManager.parseSnippetFile(m.snippetText);
                snippetManager.register(m.snippets || [], m.scope);
                if (m.includeScopes) {
                    snippetManager.snippetMap[m.scope].includeScopes = m.includeScopes;
                    m.includeScopes.forEach(function(x) {
                        loadSnippetFile("ace/mode/" + x);
                    });
                }
            }
        });
    };

    function getCompletionPrefix(editor) {
        var pos = editor.getCursorPosition();
        var line = editor.session.getLine(pos.row);
        var prefix;
        editor.completers.forEach(function(completer) {
        	if (completer.identifierRegexps) {
                completer.identifierRegexps.forEach(function(identifierRegex) {
                    if (!prefix && identifierRegex)
                        prefix = util.retrievePrecedingIdentifier(line, pos.column, identifierRegex);
                        
                });
            }
        });
        return prefix || util.retrievePrecedingIdentifier(line, pos.column);
    }

    var doLiveAutocomplete = function(e) {
        var editor = e.editor;
        var text = e.args || "";
        var hasCompleter = editor.completer && editor.completer.activated;
        if (e.command.name === "backspace") {
            if (hasCompleter && !getCompletionPrefix(editor))
                editor.completer.detach();
        }
        else if (e.command.name === "insertstring") {
            var prefix = getCompletionPrefix(editor);
            if (prefix && !hasCompleter) {
                editor.execCommand("startAutocomplete");
            }
        }
    };
    var Autocomplete = require("../autocomplete").Autocomplete;
    Autocomplete.startCommand = {
        name: "startAutocomplete",
        exec: function(editor, e) {
            if (!editor.completer) {
                editor.completer = new Autocomplete();
            }
            editor.completers = [];
            if (editor.$enableSnippets) { //snippets are allowed with or without tern
                editor.completers.push(snippetCompleter);
                
            }

            if (editor.ternServer && editor.$enableTern) {
                if (editor.ternServer.enabledAtCurrentLocation(editor)) {
                    editor.completers.push(editor.ternServer);
                    editor.ternServer.aceTextCompletor = textCompleter; //9.30.2014- give tern the text completor
                }
                else {
                    if (editor.$enableBasicAutocompletion) {
                        editor.completers.push(textCompleter, keyWordCompleter);
                    }
                }
            }
            else { //tern not enabled
                if (editor.$enableBasicAutocompletion) {
                    editor.completers.push(textCompleter, keyWordCompleter);
                }
            }
            editor.completer.showPopup(editor);
            editor.completer.cancelContextMenu();
        },
        bindKey: "Ctrl-Space|Ctrl-Shift-Space|Alt-Space"
    };
    var onChangeMode = function(e, editor) {
        loadSnippetsForMode(editor.session.$mode);
    };
    var ternOptions = {};

    var TernServer = require("./tern_server").TernServer;
    var aceTs;
    var createTernServer = function(cb) {
        var src = ternOptions.workerScript || config.moduleUrl('worker/tern');
        if (ternOptions.useWorker === false) {
            var id = 'ace_tern_files';
            if (document.getElementById(id)) inner();
            else {
                var el = document.createElement('script');
                el.setAttribute('id', id);
                document.head.appendChild(el);
                el.onload = inner;
                el.setAttribute('src', src);
            }
        }
        else inner();

        function inner() {
            if (!ternOptions.workerScript) ternOptions.workerScript = src;
            aceTs = new TernServer(ternOptions);
            cb();
        }
    };
    var editor_for_OnCusorChange = null;
    var debounceArgHints;
    var onCursorChange_Tern = function(e, editor_getSession_selection) {
        clearTimeout(debounceArgHints);
        debounceArgHints = setTimeout(function() {
            editor_for_OnCusorChange.ternServer.updateArgHints(editor_for_OnCusorChange);
        }, 10);
    };
    var onAfterExec_Tern = function(e, commandManager) {
        if (e.command.name === "insertstring" && e.args === ".") {
            if (e.editor.ternServer && e.editor.ternServer.enabledAtCurrentLocation(e.editor)) {
                var pos = e.editor.getSelectionRange().end;
                var tok = e.editor.session.getTokenAt(pos.row, pos.column);
                if (tok) {
                    if (tok.type !== 'string' && tok.type.toString().indexOf('comment') === -1) {
                        try {
                            e.editor.ternServer.lastAutoCompleteFireTime = null; //reset since this was not triggered by user firing command but triggered automatically
                        }
                        catch (ex) {}
                        e.editor.execCommand("startAutocomplete");
                    }
                }
            }
        }
    };
	if(aceTs){
    completers.push(aceTs);
    exports.server = aceTs;
}
    var Editor = require("../editor").Editor;
    config.defineOptions(Editor.prototype, "editor", {
        enableTern: {
            set: function(val) {
                var self = this;
                if (typeof val === 'object') {
                    ternOptions = val;
                    val = true;
                }
                if (val) {
                    editor_for_OnCusorChange = self; //hack
                    createTernServer(function() {
                        self.completers = completers;
                        self.ternServer = aceTs;
                        self.commands.addCommand(Autocomplete.startCommand);
                        self.on('changeSelection', onCursorChange_Tern);
                        self.commands.on('afterExec', onAfterExec_Tern);
                        aceTs.bindAceKeys(self);
                        if (ternOptions.startedCb) ternOptions.startedCb();
                    });
                }
                else {
                    delete self.ternServer;
                    self.off('changeSelection', onCursorChange_Tern);
                    self.commands.off('afterExec', onAfterExec_Tern);
                    if (!self.enableBasicAutocompletion) {
                        self.commands.removeCommand(Autocomplete.startCommand);
                    }
                }
            },
            value: false
        },
        enableBasicAutocompletion: {
            set: function(val) {
                if (val) {
                    this.completers = completers;
                    this.commands.addCommand(Autocomplete.startCommand);
                }
                else {
                    if (!this.$enableTern) {
                        this.commands.removeCommand(Autocomplete.startCommand);
                    }
                }
            },
            value: false
        },enableLiveAutocompletion: {
        set: function(val) {
        if (val) {
        if (!this.completers)
        this.completers = Array.isArray(val)? val: completers;
        this.commands.on('afterExec', doLiveAutocomplete);
        } else {
        this.commands.removeListener('afterExec', doLiveAutocomplete);
        }
        },
        value: false
        },
        enableSnippets: {
            set: function(val) {
                if (val) {
                    this.commands.addCommand(expandSnippet);
                    this.on("changeMode", onChangeMode);
                    onChangeMode(null, this);
                }
                else {
                    this.commands.removeCommand(expandSnippet);
                    this.off("changeMode", onChangeMode);
                }
            },
            value: false
        }
    });
});
                (function() {
                    ace.require(["ace/tern/tern"], function() {});
                })();
            