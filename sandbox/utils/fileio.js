'use strict';

const fs = require('fs');
const { promisify } = require('util');
const _ = require('lodash');
const path = require('path');

// Get file names from folder path.
async function getFileNames(folderPath) {
    const readdir = promisify(fs.readdir);
    const fileNames = await readdir(folderPath);
    return _.without(fileNames, '.DS_Store', 'encodings');
}

/**
 * Takes a single filePath and gets that file's contents.
 *
 * @param {filePath} string - path to the file to be parsed.
 * @returns object - an object with the file name/path.
 */
async function getSingleFileContents(filePath) {
    const readFile = promisify(fs.readFile);
    const fileContents = await readFile(filePath, 'utf8');
    return {
        file: filePath,
        // strip unicode BOM marker as it causes problems with CSV parsing
        contents: fileContents.replace(/^\uFEFF/, ''),
    };
}

/**
 * Takes an array of file names, and retrieves the contents of the files.
 *
 *  @param {folderPath} string - a string path to the folder.
 *  @param {fileNames} array - an array of file names for parsing.
 * @returns array - an array of all of the contents of the files parsed.
 */
async function getFileContents(folderPath, fileNames) {
    const filePaths = [];
    for (let i = 0; i < fileNames.length; i += 1) {
        filePaths.push(path.join(`${folderPath}/${fileNames[i]}`));
    }
    const promises = filePaths.map(getSingleFileContents);
    const readResults = await Promise.all(promises);
    return readResults;
}

/**
 * Takes a folderPath and creates the folder if it does not exist.
 *
 *  @param {folderPath} string - a string path to the folder.
 *
 * */
async function createFolder(folderPath) {
    // fs.exists() is deprecated!!!
    const mkdir = promisify(fs.mkdir);
    if (!fs.existsSync(folderPath)) {
        await mkdir(folderPath);
    }
}

const writeFile = promisify(fs.writeFile);

async function removeFile(filePath) {
    const unlink = promisify(fs.unlink);
    if (fs.existsSync(filePath)) {
        await unlink(filePath);
    }
}

async function clearFolder(folderPath) {
    const fileNames = await getFileNames(folderPath);
    fileNames.forEach(async (name) => {
        await removeFile(path.join(folderPath, name));
    });
}


module.exports = {
    getFileNames,
    getFileContents,
    getSingleFileContents,
    createFolder,
    writeFile,
    removeFile,
    clearFolder,
};
