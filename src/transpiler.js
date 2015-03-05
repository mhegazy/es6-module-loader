/*
 * Traceur and Babel transpile hook for Loader
 */
(function(Loader) {
  // Returns an array of ModuleSpecifiers
  var transpiler, transpilerModule;
  var isNode = typeof window == 'undefined' && typeof WorkerGlobalScope == 'undefined';

  // use Traceur by default
  Loader.prototype.transpiler = 'traceur';

  Loader.prototype.transpile = function(load) {
    if (!transpiler) {
      if (this.transpiler == 'babel') {
        transpiler = babelTranspile;
        transpilerModule = isNode ? require('babel-core') : __global.babel;
      }
      else if (this.transpiler == 'typescript') {
        transpiler = typescriptTranspile;
        transpilerModule = isNode ? require('typescript') : __global.ts;
      }
      else {
        transpiler = traceurTranspile;
        transpilerModule = isNode ? require('traceur') : __global.traceur;
      }
      
      if (!transpilerModule)
        throw new TypeError('Include Traceur, Babel or TypeScript for module syntax support.');
    }

    return 'var __moduleAddress = "' + load.address + '";' + transpiler.call(this, load);
  }

  function traceurTranspile(load) {
    var options = this.traceurOptions || {};
    options.modules = 'instantiate';
    options.script = false;
    options.sourceMaps = 'inline';
    options.filename = load.address;
    options.inputSourceMap = load.metadata.sourceMap;

    var compiler = new transpilerModule.Compiler(options);
    var source = doTraceurCompile(load.source, compiler, options.filename);

    // add "!eval" to end of Traceur sourceURL
    // I believe this does something?
    source += '!eval';

    return source;
  }
  function doTraceurCompile(source, compiler, filename) {
    try {
      return compiler.compile(source, filename);
    }
    catch(e) {
      // traceur throws an error array
      throw e[0];
    }
  }

  function babelTranspile(load) {
    var options = this.babelOptions || {};
    options.modules = 'system';
    options.sourceMap = 'inline';
    options.filename = load.address;
    options.code = true;
    options.ast = false;
    options.blacklist = options.blacklist || [];
    options.blacklist.push('react');

    var source = transpilerModule.transform(load.source, options).code;

    // add "!eval" to end of Babel sourceURL
    // I believe this does something?
    return source + '\n//# sourceURL=' + load.address + '!eval';
  }

function defineShim(dependencyNames, module) {
  var deps = dependencyNames.slice(2);
    return System.register(deps, function ($__export) {
      var require = {};
      var exports = {};
      var imports = [require, exports];
      var setters = [];
      for (var i = 0, n = deps.length; i < n; i++) {
          setters.push((function (index) {
              return function (v) { imports[2+index] = v; };
          })(i));
      }

      return {
          setters: setters,
          execute: function () {
              module.apply(undefined, imports);
              for (var i in exports) {
                  $__export(i, exports[i]);
              }
          }
        };
    });
}

function typescriptTranspile(load) {
  var ts = transpilerModule;
  var options = this.typescriptOptions || {};
  options.module = ts.ModuleKind.AMD;

  var contents = load.source;
  var inputName = 'file1.ts';
  var output = 'var define = ' + defineShim.toString()  + "; ";
  var sourceFile = ts.createSourceFile(inputName, contents , ts.ScriptTarget.ES5);

  var compilerHost = {
    getSourceFile: function (fileName, target) {
      return fileName === inputName ? ts.createSourceFile(fileName, contents , target) : undefined;
    },
    writeFile: function(name, text) { output += text;},
    getDefaultLibFileName: function() { return "lib.d.ts"; },
    useCaseSensitiveFileNames: function() {return false; },
    getCanonicalFileName: function(fileName) { return fileName; },
    getCurrentDirectory: function() { return ""; },
    getNewLine: function() { return "\n"; }
  };

  var program = ts.createProgram([inputName], options, compilerHost);
  var emitResult = program.emit();

  return output;
}

})(__global.LoaderPolyfill);