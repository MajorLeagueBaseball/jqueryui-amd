/**
 * @license Copyright (c) 2010, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */

/**
 * This file converts jQuery UI files to use define() syntax.
 *
 * It should be run in node (only 0.2.x tested), using the r.js RequireJS
 * adapter for Node, available at:
 * http://requirejs.org/docs/download.html#node
 */

'use strict';
/*jslint regexp: false, plusplus: false */
/*global require: false, process: false, console: false */

require(['fs', 'path', 'sys'], function (fs, path, sys) {
    var inDir = process.argv[3],
        outDir = process.argv[4],
        useNames = true, //process.argv[5] === 'named',
        jqUiFileRegExp = /jquery-ui\.js$/,
        jsFileRegExp = /\.js$/,
        dependStartRegExp =  /\*\s+Depends\:([^\/]+)\*\//,
        dotRegExp = /\./g,
        filesRegExp = /([\w\.]+)\.js/g,
        jqUiSrcDir, jqUiDir, jqPaths,
        copyList = [],
        copyIndex = 0;

    function mkDir(dir) {
        if (!path.existsSync(dir)) {
            fs.mkdirSync(dir, 0777);
        }
    }

    /**
     * Copies one file from the copyList to outputDir. Only does
     * One at a time given the callback nature of sys.pump. If no more
     * files to copy, execute onComplete callback.
     * @param {Function} onComplete a function that is called when all
     * files have finished copying.
     */
    function copy(onComplete) {
        if (copyIndex < copyList.length) {

            var copyArgs = copyList[copyIndex++];
            //console.log("Copying file: " + copyArgs[0] + " to: " + copyArgs[1]);

            sys.pump(fs.createReadStream(copyArgs[0]),
                    fs.createWriteStream(copyArgs[1]),
                    function () {
                        copy(onComplete);
                    }
            );
        } else {
            onComplete();
        }
    }

    /**
     * Finds all files to copy and creates any directories that are needed.
     * Also looks for jquery-ui.js anchor file.
     * @param {String} inDir the input directory name
     * @param {String} outDir the output directory name
     */
    function findFiles(inDir, outDir) {
        var paths = fs.readdirSync(inDir),
            outPath, stat, input, output;

        paths.forEach(function (inPath) {
            outPath = outDir + inPath;
            inPath = inDir + inPath;

            stat = fs.statSync(inPath);
            if (stat.isDirectory()) {
                mkDir(outDir);
                findFiles(inPath + '/', outPath + '/');
            } else if (stat.isFile()) {
                copyList.push([inPath, outPath]);

                if (jqUiFileRegExp.test(outPath)) {
                    jqUiSrcDir = outPath.split('/');
                    //Pop off the file name.
                    jqUiSrcDir.pop();
                    jqUiSrcDir = jqUiSrcDir.join('/') + '/';
                }
            }
        });
    }

    /**
     * Converts the contents of a file to an AMD module.
     * @param {String} contents the file contents.
     */
    function convert(fileName) {
debugger;
        //Find dependencies.
        var contents = fs.readFileSync(jqUiSrcDir + fileName, 'utf8'),
            match = dependStartRegExp.exec(contents),
            files = ["'jquery'", "'jquery-ui'"],
            fileParts = fileName.split('.'),
            tempDir = jqUiDir,
            moduleName, outFileName, i, segment;

        //Strip off .js extension and convert jquery-ui to jqueryui,
        //generate module name.
        fileParts.pop();
        if (fileParts[0] === 'jquery-ui') {
            moduleName = fileParts[0] = 'jqueryui';
            outFileName = jqUiDir + 'jqueryui.js';
        } else {
            //convert preceding 'jquery' to 'jqueryui'
            fileParts[0] = 'jqueryui';
            moduleName = fileParts.join('/');
            outFileName = jqUiDir + moduleName + '.js';
        }

        //Make sure directories exist in the jqueryui section.
        if (moduleName !== 'jqueryui') {
            for (i = 0; i < fileParts.length - 1 && (segment = fileParts[i]); i++) {
                tempDir += segment + '/';
                mkDir(tempDir);
            }
        }

        if (match) {
            match[1].replace(filesRegExp, function (match, depName) {
                files.push("'" + depName.replace(dotRegExp, '/') + "'");
            });
        }

        contents = 'define(' + (useNames ? "'" + moduleName + "', " : '') +
               '[' + files.join(',') + '], function (jQuery) {\n' +
               contents +
               '\n});';

        fs.writeFileSync(outFileName, contents);
    }

    //Make sure required fields are present.
    if (!inDir || !outDir) {
        console.log('Usage: node r.js convert.js inputDir outputDir [named]');
        return;
    }

    //Normalize directories
    inDir = path.normalize(inDir);
    if (inDir.lastIndexOf('/') !== inDir.length - 1) {
        inDir += '/';
    }
    outDir = path.normalize(outDir);
    if (outDir.lastIndexOf('/') !== outDir.length - 1) {
        outDir += '/';
    }

    console.log("Converting: " + inDir + " to: " + outDir);

    mkDir(outDir);

    //Find all the files to transfer from input to output
    findFiles(inDir, outDir);

    //Now trigger the actual copy.
    copy(function () {
        //If did not find base jQuery UI file, error out.
        if (!jqUiSrcDir) {
            console.log('The directory does not appear to contain jQuery UI, not converting any files.');
            return;
        }
debugger;
        //Make the base jqueryui folder.
        jqUiDir = jqUiSrcDir.split('/');
        jqUiDir.pop();
        jqUiDir.pop();
        jqUiDir = jqUiDir.join('/') + '/';

        //For each file that is a sibling to jquery-ui, transform to define.
        jqPaths = fs.readdirSync(jqUiSrcDir);
        jqPaths.forEach(function (fileName) {
            var srcPath = jqUiSrcDir + fileName;
            if (fs.statSync(srcPath).isFile() && jsFileRegExp.test(srcPath)) {
                //console.log("Converting file: " + convertPath);
                convert(fileName);
            }
        });
    });
});
