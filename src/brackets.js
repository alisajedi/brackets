/*
 * Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */


/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global require, define, brackets: true, $, window, navigator, Mustache */

require.config({
    paths: {
        "text"      : "thirdparty/text/text",
        "i18n"      : "thirdparty/i18n/i18n"
    },
    // Use custom brackets property until CEF sets the correct navigator.language
    // NOTE: When we change to navigator.language here, we also should change to
    // navigator.language in ExtensionLoader (when making require contexts for each
    // extension).
    locale: window.localStorage.getItem("locale") || (typeof (brackets) !== "undefined" ? brackets.app.language : navigator.language)
});

/**
 * brackets is the root of the Brackets codebase. This file pulls in all other modules as
 * dependencies (or dependencies thereof), initializes the UI, and binds global menus & keyboard
 * shortcuts to their Commands.
 *
 * TODO: (issue #264) break out the definition of brackets into a separate module from the application controller logic
 *
 * Unlike other modules, this one can be accessed without an explicit require() because it exposes
 * a global object, window.brackets.
 */
define(function (require, exports, module) {
    "use strict";
    
    // Load dependent non-module scripts
    require("widgets/bootstrap-dropdown");
    require("widgets/bootstrap-modal");
    require("widgets/bootstrap-twipsy-mod");
    require("thirdparty/path-utils/path-utils.min");
    require("thirdparty/smart-auto-complete/jquery.smart_autocomplete");
    
    // Load dependent modules
    var Global                  = require("utils/Global"),
        AppInit                 = require("utils/AppInit"),
        LanguageManager         = require("language/LanguageManager"),
        ProjectManager          = require("project/ProjectManager"),
        DocumentManager         = require("document/DocumentManager"),
        EditorManager           = require("editor/EditorManager"),
        CSSInlineEditor         = require("editor/CSSInlineEditor"),
        JSUtils                 = require("language/JSUtils"),
        WorkingSetView          = require("project/WorkingSetView"),
        WorkingSetSort          = require("project/WorkingSetSort"),
        DocumentCommandHandlers = require("document/DocumentCommandHandlers"),
        FileViewController      = require("project/FileViewController"),
        FileSyncManager         = require("project/FileSyncManager"),
        KeyBindingManager       = require("command/KeyBindingManager"),
        Commands                = require("command/Commands"),
        CommandManager          = require("command/CommandManager"),
        CodeHintManager         = require("editor/CodeHintManager"),
        PerfUtils               = require("utils/PerfUtils"),
        FileSystemManager       = require("filesystem/FileSystemManager"),
        QuickOpen               = require("search/QuickOpen"),
        Menus                   = require("command/Menus"),
        FileUtils               = require("file/FileUtils"),
        MainViewHTML            = require("text!htmlContent/main-view.html"),
        Strings                 = require("strings"),
        Dialogs                 = require("widgets/Dialogs"),
        DefaultDialogs          = require("widgets/DefaultDialogs"),
        ExtensionLoader         = require("utils/ExtensionLoader"),
        SidebarView             = require("project/SidebarView"),
        Async                   = require("utils/Async"),
        UpdateNotification      = require("utils/UpdateNotification"),
        UrlParams               = require("utils/UrlParams").UrlParams,
        PreferencesManager      = require("preferences/PreferencesManager"),
        Resizer                 = require("utils/Resizer"),
        LiveDevelopmentMain     = require("LiveDevelopment/main"),
        NodeConnection          = require("utils/NodeConnection"),
        ExtensionUtils          = require("utils/ExtensionUtils"),
        DragAndDrop             = require("utils/DragAndDrop"),
        ColorUtils              = require("utils/ColorUtils"),
        CodeInspection          = require("language/CodeInspection"),
        NativeApp               = require("utils/NativeApp");
        
    // Load modules that self-register and just need to get included in the main project
    require("command/DefaultMenus");
    require("document/ChangedDocumentTracker");
    require("editor/EditorStatusBar");
    require("editor/EditorCommandHandlers");
    require("editor/EditorOptionHandlers");
    require("view/ViewCommandHandlers");
    require("help/HelpCommandHandlers");
    require("search/FindInFiles");
    require("search/FindReplace");
    require("extensibility/InstallExtensionDialog");
    require("extensibility/ExtensionManagerDialog");
    
    PerfUtils.addMeasurement("brackets module dependencies resolved");

    // Local variables
    var params = new UrlParams();
    
    // read URL params
    params.parse();
    
    function _initTest() {
        // TODO: (issue #265) Make sure the "test" object is not included in final builds
        // All modules that need to be tested from the context of the application
        // must to be added to this object. The unit tests cannot just pull
        // in the modules since they would run in context of the unit test window,
        // and would not have access to the app html/css.
        brackets.test = {
            PreferencesManager      : PreferencesManager,
            ProjectManager          : ProjectManager,
            DocumentCommandHandlers : DocumentCommandHandlers,
            FileViewController      : FileViewController,
            DocumentManager         : DocumentManager,
            EditorManager           : EditorManager,
            Commands                : Commands,
            WorkingSetView          : WorkingSetView,
            PerfUtils               : PerfUtils,
            JSUtils                 : JSUtils,
            CommandManager          : CommandManager,
            FileSyncManager         : FileSyncManager,
            Menus                   : Menus,
            KeyBindingManager       : KeyBindingManager,
            CodeHintManager         : CodeHintManager,
            Dialogs                 : Dialogs,
            DefaultDialogs          : DefaultDialogs,
            CodeInspection          : CodeInspection,
            CSSUtils                : require("language/CSSUtils"),
            LiveDevelopment         : require("LiveDevelopment/LiveDevelopment"),
            LiveDevServerManager    : require("LiveDevelopment/LiveDevServerManager"),
            DOMAgent                : require("LiveDevelopment/Agents/DOMAgent"),
            Inspector               : require("LiveDevelopment/Inspector/Inspector"),
            NativeApp               : NativeApp,
            ExtensionLoader         : ExtensionLoader,
            ExtensionUtils          : ExtensionUtils,
            UpdateNotification      : require("utils/UpdateNotification"),
            InstallExtensionDialog  : require("extensibility/InstallExtensionDialog"),
            RemoteAgent             : require("LiveDevelopment/Agents/RemoteAgent"),
            HTMLInstrumentation     : require("language/HTMLInstrumentation"),
            doneLoading             : false
        };

        AppInit.appReady(function () {
            brackets.test.doneLoading = true;
        });
    }
    
    brackets.unsupportedInBrowser = function () {
        if (brackets.inBrowser) {
            Dialogs.showModalDialog(
                DefaultDialogs.DIALOG_ID_ERROR,
                Strings.ERROR_IN_BROWSER_TITLE,
                Strings.ERROR_IN_BROWSER
            );
        }
        return brackets.inBrowser;
    };
    
    function _onReady() {
        PerfUtils.addMeasurement("window.document Ready");

        EditorManager.setEditorHolder($("#editor-holder"));

        // Use quiet scrollbars if we aren't on Lion. If we're on Lion, only
        // use native scroll bars when the mouse is not plugged in or when
        // using the "Always" scroll bar setting. 
        var osxMatch = /Mac OS X 10\D([\d+])\D/.exec(navigator.userAgent);
        if (osxMatch && osxMatch[1] && Number(osxMatch[1]) >= 7) {
            // test a scrolling div for scrollbars
            var $testDiv = $("<div style='position:fixed;left:-50px;width:50px;height:50px;overflow:auto;'><div style='width:100px;height:100px;'/></div>").appendTo(window.document.body);
            
            if ($testDiv.outerWidth() === $testDiv.get(0).clientWidth) {
                $(".sidebar").removeClass("quiet-scrollbars");
            }
            
            $testDiv.remove();
        }

        // Load default languages
        LanguageManager.ready.always(function () {
            // Load all extensions. This promise will complete even if one or more
            // extensions fail to load.
            var extensionLoaderPromise = ExtensionLoader.init(params.get("extensions"));
            
            // Load the initial project after extensions have loaded
            extensionLoaderPromise.always(function () {
                var initialProjectPath, initialProjectFs;
                if (brackets.inBrowser && params.get("project")) {
                    initialProjectPath = params.get("project");
                    initialProjectFs = "test-server-fs";  // TODO: should this be passed in too?
                } else {
                    initialProjectPath = ProjectManager.getInitialProjectPath();
                }
                ProjectManager.openProject(initialProjectPath, initialProjectFs).always(function () {
                    _initTest();
                    
                    // If this is the first launch, and we have an index.html file in the project folder (which should be
                    // the samples folder on first launch), open it automatically. (We explicitly check for the
                    // samples folder in case this is the first time we're launching Brackets after upgrading from
                    // an old version that might not have set the "afterFirstLaunch" pref.)
                    var prefs = PreferencesManager.getPreferenceStorage(module),
                        deferred = new $.Deferred();
                    //TODO: Remove preferences migration code
                    PreferencesManager.handleClientIdChange(prefs, "com.adobe.brackets.startup");
                    
                    if (!params.get("skipSampleProjectLoad") && !prefs.getValue("afterFirstLaunch")) {
                        prefs.setValue("afterFirstLaunch", "true");
                        if (ProjectManager.isWelcomeProjectPath(initialProjectPath)) {
                            brackets.appFileSystem.resolve(initialProjectPath + "/index.html")
                                .done(function (file) {
                                    var promise = CommandManager.execute(Commands.FILE_ADD_TO_WORKING_SET, { fullPath: file.fullPath });
                                    promise.then(deferred.resolve, deferred.reject);
                                })
                                .fail(function () {
                                    deferred.reject();
                                });
                        } else {
                            deferred.resolve();
                        }
                    } else {
                        deferred.resolve();
                    }
                    
                    deferred.always(function () {
                        // Signal that Brackets is loaded
                        AppInit._dispatchReady(AppInit.APP_READY);
                        
                        PerfUtils.addMeasurement("Application Startup");
                    });
                    
                    // See if any startup files were passed to the application
                    if (brackets.inBrowser) {
                        // Note: if "file" specified, "project" must have been specified too
                        if (params.get("file")) {
                            CommandManager.execute(Commands.FILE_OPEN, { fullPath: ProjectManager.getProjectRoot().fullPath + "/" + params.get("file") });
                        }
                    } else if (brackets.app.getPendingFilesToOpen) {
                        brackets.app.getPendingFilesToOpen(function (err, files) {
                            files.forEach(function (filename) {
                                CommandManager.execute(Commands.FILE_OPEN, { fullPath: filename });
                            });
                        });
                    }
                });
            });
        });
        
        // Check for updates
        if (!params.get("skipUpdateCheck") && !brackets.inBrowser) {
            // check once a day, plus 2 minutes, 
            // as the check will skip if the last check was not -24h ago
            window.setInterval(UpdateNotification.checkForUpdate, 86520000);
            
            // Check for updates on App Ready
            AppInit.appReady(function () {
                UpdateNotification.checkForUpdate();
            });
        }
    }
    
    /**
     * Setup event handlers prior to dispatching AppInit.HTML_READY
     */
    function _beforeHTMLReady() {
        // Add the platform (mac or win) to the body tag so we can have platform-specific CSS rules
        $("body").addClass("platform-" + brackets.platform);
        
        // Browser-hosted version may also have different CSS (e.g. since '#titlebar' is shown)
        if (brackets.inBrowser) {
            $("body").addClass("in-browser");
        } else {
            $("body").addClass("in-appshell");
        }

        // Enable/Disable HTML Menus
        if (brackets.nativeMenus) {
            $("body").addClass("has-appshell-menus");
        } else {
            // Prevent the menu item to grab the focus -- override focus implementation
            (function () {
                var defaultFocus = $.fn.focus;
                $.fn.focus = function () {
                    if (!this.hasClass("dropdown-toggle")) {
                        defaultFocus.apply(this, arguments);
                    }
                    return this; // FIXME: merge up w/ master!
                };
            }());
        }
        
        // Localize MainViewHTML and inject into <BODY> tag
        $("body").html(Mustache.render(MainViewHTML, Strings));
        
        // Update title
        $("title").text(brackets.config.app_title);
            
        // Prevent unhandled drag and drop of files into the browser from replacing 
        // the entire Brackets app. This doesn't prevent children from choosing to
        // handle drops.
        $(window.document.body)
            .on("dragover", function (event) {
                var dropEffect = "none";
                if (event.originalEvent.dataTransfer.files) {
                    event.stopPropagation();
                    event.preventDefault();
                    if (DragAndDrop.isValidDrop(event.originalEvent.dataTransfer.items)) {
                        dropEffect = "copy";
                    }
                    event.originalEvent.dataTransfer.dropEffect = dropEffect;
                }
            })
            .on("drop", function (event) {
                if (event.originalEvent.dataTransfer.files) {
                    event.stopPropagation();
                    event.preventDefault();
                    brackets.app.getDroppedFiles(function (err, files) {
                        if (!err) {
                            DragAndDrop.openDroppedFiles(files);
                        }
                    });
                }
            });
        
        // TODO: (issue 269) to support IE, need to listen to document instead (and even then it may not work when focus is in an input field?)
        $(window).focus(function () {
            FileSyncManager.syncOpenDocuments(); // TODO: FileSystem - remove now that we have file watchers?
        });
        
        $(brackets.appFileSystem).on("change", function (item) {
            // TODO: FileSystem - only sync when window has focus?
            FileSyncManager.syncOpenDocuments();    // TODO: Batch multiple changes into a single sync operation
        });
        
        // Prevent unhandled middle button clicks from triggering native behavior
        // Example: activating AutoScroll (see #510)
        $("html").on("mousedown", ".inline-widget", function (e) {
            if (e.button === 1) {
                e.preventDefault();
            }
        });
        
        // The .no-focus style is added to clickable elements that should
        // not steal focus. Calling preventDefault() on mousedown prevents
        // focus from going to the click target.
        $("html").on("mousedown", ".no-focus", function (e) {
            // Text fields should always be focusable.
            var $target = $(e.target),
                isTextField =
                    $target.is("input[type=text]") ||
                    $target.is("input[type=number]") ||
                    $target.is("input[type=password]") ||
                    $target.is("input:not([type])") || // input with no type attribute defaults to text
                    $target.is("textarea");
    
            if (!isTextField) {
                e.preventDefault();
            }
        });
        
        // Prevent clicks on any link from navigating to a different page (which could lose unsaved
        // changes). We can't use a simple .on("click", "a") because of http://bugs.jquery.com/ticket/3861:
        // jQuery hides non-left clicks from such event handlers, yet middle-clicks still cause CEF to
        // navigate. Also, a capture handler is more reliable than bubble.
        window.document.body.addEventListener("click", function (e) {
            // Check parents too, in case link has inline formatting tags
            var node = e.target, url;
            while (node) {
                if (node.tagName === "A") {
                    url = node.getAttribute("href");
                    if (url && !url.match(/^#/)) {
                        NativeApp.openURLInDefaultBrowser(url);
                    }
                    e.preventDefault();
                    break;
                }
                node = node.parentElement;
            }
        }, true);
    }

    // Dispatch htmlReady event
    _beforeHTMLReady();
    AppInit._dispatchReady(AppInit.HTML_READY);

    $(window.document).ready(_onReady);
});
