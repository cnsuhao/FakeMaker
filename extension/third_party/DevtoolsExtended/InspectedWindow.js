// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2013 Google Inc. johnjbarton@google.com

// Model of the debuggee based on chrome.devtools callback data

// requires DebugLogger, mixinPropertyEvent

(function(global){
  'use strict';

  var debug = DebugLogger.register('InspectedWindow', function(flag){
    return debug = (typeof flag === 'boolean') ? flag : debug;
  });

  var InspectedWindow = {

    // Array<chrome.devtools.inspectedWindow.Resource>
    get resources() {
      return this._resources;
    },

    // String
    get url() {
      return this._url;
    },

    set injectedScript(scriptString) {
      console.assert(!scriptString || typeof scriptString === 'string');
      this._injectedScript = scriptString;
      this._synchronizedWithWindow = false;
    },

    set preprocessingScript(scriptString) {
      console.assert(!scriptString || typeof scriptString === 'string');
      this._preprocessingScript = scriptString;
      this._synchronizedWithWindow = false;
    },

    reload: function() {
      if (this._injectedScript || this._preprocessingScript)
        this._reloadRuntime();
      else
        chrome.devtools.inspectedWindow.reload();
    },

    monitorOnListenersChanged: function(nowHaveOnURLChangedListeners) {
      if (nowHaveOnURLChangedListeners) {
        console.assert(!this._addedListener)
        chrome.devtools.network.onNavigated.addListener(this._checkURLChanged);
        this._addedListener = true;
        chrome.devtools.inspectedWindow.eval('window.location.href', function(url) {
          this._checkURLChanged(url);
        }.bind(this));
      } else {
        chrome.devtools.network.onNavigated.removeListener(this._checkURLChanged);
        delete this._addedListener;
      }
    },

    monitorResources: function() {
      this._resources = [];
      chrome.devtools.inspectedWindow.onResourceAdded.addListener(this._addResource.bind(this));
      chrome.devtools.inspectedWindow.getResources(function onResources(resources){
        if (debug) console.log("getResources", resources.map(function(resource){return resource.url}));
        resources.forEach(this._addResource.bind(this));
      }.bind(this));
    },

    _reloadRuntime: function() {
      this._loadingRuntime = true;
      var reloadOptions = {
        ignoreCache: true,
        injectedScript:  this._injectedScript || undefined,
        preprocessingScript: this._preprocessingScript ? '(' + this._preprocessingScript + ')' : undefined
      };
      if (debug) console.log("reloadOptions ", reloadOptions);
      chrome.devtools.inspectedWindow.reload(reloadOptions);
    },

    _checkURLChanged: function(url) {
      this._resources = [];
      if (url !== this._url) {  // Start monitoring or user moved to new URL
        this._url = url;
        this.onURLChanged.fireListeners(url);
      }
      if (!this._synchronizedWithWindow) { // reloaded by our function
        this._checkRuntimeInstalled();
        this._synchronizedWithWindow = true;
      } else {
        if (this._runtimeInstalled)  // force our runtime back, maybe annoying to user?
          this._reloadRuntime();
        else
          this._checkRuntimeInstalled();
      }

      if (debug)
        console.log("InspectedWindow.onURLChanged " + url + '----------------------------');
    },

    _checkRuntimeInstalled: function() {
      this.onRuntimeChanged.fireListeners(this._injectedScript, this._preprocessingScript);
    },

    _addResource: function(resource) {
      if (!resource.url)  // I guess these are console evaluations for example.
        return;
      if (debug) console.log("addResource " + resource.url + ' to ' + this._resources.length + " resources");
      this._resources.push(resource);
    },
  };

  InspectedWindow._checkURLChanged = InspectedWindow._checkURLChanged.bind(InspectedWindow);

  global.DevtoolsExtended = global.DevtoolsExtended || {};
  InspectedWindow = DevtoolsExtended.mixinPropertyEvent(InspectedWindow, 'onURLChanged');
  InspectedWindow = DevtoolsExtended.mixinPropertyEvent(InspectedWindow, 'onRuntimeChanged');

  InspectedWindow.onURLChanged.metaListener = InspectedWindow.monitorOnListenersChanged.bind(InspectedWindow);
  InspectedWindow.onRuntimeChanged.metaListener = InspectedWindow.monitorOnListenersChanged.bind(InspectedWindow);

  DevtoolsExtended.InspectedWindow = InspectedWindow;

}(this));
