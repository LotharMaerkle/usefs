/**
 *
 * UseFS HTML5 File API with Promises. Simplifies File-API usage.
 *
 *
 The MIT License (MIT)

 Copyright (c) 2014 Lothar Märkle

 Permission is hereby granted, free of charge, to any person obtaining a copy of
 this software and associated documentation files (the "Software"), to deal in
 the Software without restriction, including without limitation the rights to
 use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 the Software, and to permit persons to whom the Software is furnished to do so,
 subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

function UseFS(config) {
    // from q.js
    if(config) {
        this.q = config.q;

    }
    if (!this.q) {
        // from q.js or angulars $q
        this.q = Q;
    }


    if(!this.q) {
        throw 'not enough Q to proceed';
    }
    return this;
}


// some static filename helpser
// missing: port all from Apache commons FilenameUtils class
UseFS.getName = function( path) {
    var name = path.replace(/^.*\/([^/]*)$/, '$1');

    return name;
};

UseFS.prototype.fs = function () {
    var def = this.q.defer();

    window.requestFileSystem(LocalFileSystem.PERSISTENT, 1024 * 1024, function (filesystem) {
            def.resolve(filesystem);
        },
        function (err) {
            def.reject(err);
        }
    );

    def.promise.useDir = this.create_useDir(def);
    def.promise.useFile = this.create_useFile(def);

    return def.promise;
};



UseFS.prototype.addDirEntryOps = function (q) {
    var me = this;
    q.promise.removeAllFiles = me.create_removeAllFiles(q);
    q.promise.createSubDir = me.create_createDir(q);
    q.promise.useSubDir = me.create_useSubDir(q);
    q.promise.useFile = me.create_useFileOfDir(q);
    q.promise.exists = me.create_exists(q);

    // missing:
    // remove recursive
    // count files/subdirs
    // iterators/forEach with filters

    return q;
};

UseFS.prototype.addFileEntryOps = function (q) {
    var me = this;
    q.promise.readText = me.create_readText(q);
    q.promise.writeText = me.create_writeText(q);
    q.promise.unlink = me.create_unlink(q);
    q.promise.rename = me.create_rename(q);
    // missing
    // general move
    // append
    // read write binary stuff

    return q;
};


UseFS.prototype.create_useFile = function (q) {
    var me = this;
    var actionClosure = function (pathOrUrl) {
        var nextQ = me.q.defer();

        if (pathOrUrl.indexOf('file:///') == 0) {
            q.promise.then(function (fileSystem) {
                    window.resolveLocalFileSystemURL(pathOrUrl,
                        success,
                        fail);
                },
                fail
            );

        } else {
            q.promise.then(function (fileSystem) {
                    var options = {
                        create: false,
                        exclusive: false
                    };
                    fileSystem.root.getFile(pathOrUrl, options, success, fail);
                },
                fail
            );
        }

        function success(fileEntry) {
            nextQ.resolve(fileEntry);
        }

        function fail(error) {
            console.log("useFile failed: ", error);
            nextQ.reject(error);
        }

        me.addFileEntryOps(nextQ);

        return nextQ.promise;
    };

    return actionClosure;

};

UseFS.prototype.create_useDir = function (q) {
    var me = this;
    var actionClosure = function (pathOrUrl) {
        var nextQ = me.q.defer();

        if (pathOrUrl.indexOf('file:///') == 0) {
            q.promise.then(function (fileSystem) {
                    window.resolveLocalFileSystemURL(pathOrUrl,
                        success,
                        fail);
                },
                fail
            );

        } else {
            q.promise.then(function (fileSystem) {
                    var options = {
                        create: false,
                        exclusive: false
                    };
                    fileSystem.root.getDirectory(pathOrUrl, options, success, fail);
                },
                fail
            );
        }

        function success(dirEntry) {
            nextQ.resolve(dirEntry);
        }

        function fail(error) {
            nextQ.reject(error);
        }

        me.addDirEntryOps(nextQ);

        return nextQ.promise;
    };

    return actionClosure;
};


UseFS.prototype.create_removeAllFiles = function (q) {
    var me = this;
    var actionClosure = function () {
        var nextQ = me.q.defer();
        q.promise.then(
            function (dirEntry) {
                var dirReader = dirEntry.createReader();

                dirReader.readEntries(success, fail);
                function success(entries) {

                    var action = function () {
                        if (entries.length == 0) {

                            nextQ.resolve()

                            return;
                        }

                        var fileEntry = entries.pop();
                        fileEntry.remove(function () {
                            action();
                        }, function (error) {
                            nextQ.reject(error);
                        });
                    }

                    action();
                }

                function fail(error) {
                    console.log("op readEntries failed", error);
                    nextQ.reject(error);
                }

            },
            function (error) {
                console.log("failed to create dirEntry", error);
            }
        )

        return nextQ.promise;
    };

    return actionClosure;
};


UseFS.prototype.create_exists = function (q) {
    var me = this;
    var actionClosure = function (fileName) {
        var nextQ = me.q.defer();
        q.promise.then(
            function (dirEntry) {

                var options = {
                    create: false,
                    exclusive: false
                };
                dirEntry.getFile(fileName, options, success, fail);

                function success(entry) {
                    nextQ.resolve(entry)
                }

                function fail(error) {
                    nextQ.reject(error);
                }

            },
            function (error) {
                console.log("failed to look up file", error);
                nextQ.reject(error);
            }
        )

        return nextQ.promise;
    };

    return actionClosure;
};


UseFS.prototype.create_createDir = function (q) {
    var me = this;
    var actionClosure = function (dirName) {
        var nextQ = me.q.defer();
        q.promise.then(
            function (dirEntry) {
                var options = {
                    create: true,
                    exclusive: false
                };
                console.log("creating subdir " + dirName + ", parent", dirEntry.toURL());
                dirEntry.getDirectory(dirName, options, success, fail);
                function success(subDirEntry) {
                    nextQ.resolve(subDirEntry);
                }

                function fail(error) {
                    console.log("op createDir failed", error);
                    nextQ.reject();
                }
            },
            function (error) {
                console.log("failed to create dir", error);
            }
        )

        return nextQ.promise;
    };

    return actionClosure;
};


UseFS.prototype.create_useSubDir = function (q) {
    var me = this;
    var actionClosure = function (dirName) {
        var nextQ = me.q.defer();
        q.promise.then(function (dirEntry) {
                var options = {
                    create: false,
                    exclusive: false
                };
                dirEntry.getDirectory(dirName, options, function (dirEntry) {
                    nextQ.resolve(dirEntry);
                }, function (error) {
                    nextQ.reject(error);
                });
            },
            function (error) {
                nextQ.reject(error);
            });

        me.addDirEntryOps(nextQ);

        return nextQ.promise;
    };

    return actionClosure;
};

UseFS.prototype.create_useFileOfDir = function (q) {
    var me = this;
    var actionClosure = function (fileName) {
        var nextQ = me.q.defer();
        q.promise.then(function (dirEntry) {
                var options = {
                    create: true,
                    exclusive: false
                };
                dirEntry.getFile(fileName, options, function (fileEntry) {
                    nextQ.resolve(fileEntry);
                }, function (error) {
                    nextQ.reject(error);
                });
            },
            function (error) {
                nextQ.reject(error);
            });

        me.addFileEntryOps(nextQ);

        return nextQ.promise;
    };

    return actionClosure;
};


UseFS.prototype.create_unlink = function (q) {
    var me = this;
    var actionClosure = function () {
        var nextQ = me.q.defer();
        q.promise.then(function (fileEntry) {
                console.log("usefs: removing ", fileEntry);
                fileEntry.remove(function () {
                    nextQ.resolve();
                }, error);
            },
            error);


        function error(error) {
            console.log("usefs: unlink failed");
            nextQ.reject(error);
        };

        return nextQ.promise;
    };

    return actionClosure;
};

/**
 * Rename file in the current directory. Not a move, a simple rename.
 *
 * @param q
 * @returns {actionClosure}
 */
UseFS.prototype.create_rename = function (q) {
    var me = this;
    var actionClosure = function (newName) {
        var nextQ = me.q.defer();
        q.promise.then(function (fileEntry) {
                fileEntry.getParent(function (parentDirEntry) {
                    fileEntry.moveTo(parentDirEntry, newName, function (renamedEntry) {
                        nextQ.resolve(renamedEntry);
                    }, fail);
                }, fail);
            },
            fail);

        function fail(error) {
            nextQ.reject(error);
        }

        return nextQ.promise;
    };


    return actionClosure;
};


UseFS.prototype.create_readText = function (q) {
    var me = this;
    var actionClosure = function () {
        var nextQ = me.q.defer();
        q.promise.then(function (fileEntry) {
                var fileReader = new FileReader();

                fileReader.onload = function (progressEvent) {
                    var textData = progressEvent.target.result;
                    nextQ.resolve(textData);
                };
                fileReader.onerror = function (error) {
                    nextQ.reject(error);
                }

                fileEntry.file(success, fail);

                function success(file) {
                    fileReader.readAsText(file);
                }
            },
            fail);

        function fail(error) {
            nextQ.reject(error);
        }

        return nextQ.promise;
    };

    return actionClosure;
};


UseFS.prototype.create_writeText = function (q) {
    var me = this;
    var actionClosure = function (textData) {
        var nextQ = me.q.defer();
        q.promise.then(function (fileEntry) {
                fileEntry.createWriter(success, fail);

                function success(fileWriter) {
                    fileWriter.onwrite = function () {
                        //console.log("write", arguments);
                        nextQ.resolve();
                    };

                    fileWriter.onerror = fail;

                    fileWriter.write(textData);
                }
            },
            fail);

        function fail(error) {
            nextQ.reject(error);
        }

        return nextQ.promise;
    };

    return actionClosure;
};