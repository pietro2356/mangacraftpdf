#!/usr/bin/env node

import {confirm, select, checkbox, search} from '@inquirer/prompts';
import chalk from "chalk";
import {readdirSync, readFileSync, statSync} from 'fs';
import { join } from 'path';
import { jsPDF } from 'jspdf';
import * as path from "node:path";
let files = [];
let customCoverImage = null;
let wantCustomCover;
let wantChapterSeparator;

const log = console.log;

const error = chalk.bold.red;
const warning = chalk.bold.hex('#FFA500'); // Orange color
const success = chalk.bold.green;
const debug = chalk.bold.blue;
const info = chalk.bold.white;

const ROOT_DIR = join("."); // TODO: change this to the root directory of your manga collection

log(debug('Current directory: ' + process.cwd() + "\n"));
const FOLDER_IN_CURRENT_DIR_LIST = findManga(ROOT_DIR);


// Select the manga to convert
const selectedMangaFolder = await select({
    message: 'Select the manga you want to convert to PDF:',
    choices: FOLDER_IN_CURRENT_DIR_LIST
});

// Select the volumes to convert
const volumesToConvert = await checkbox({
    message: `Select the volumes of ${selectedMangaFolder} you want to convert:`,
    choices: convertStringArrayToObjectArray(
        findVolumes(
            join(ROOT_DIR, selectedMangaFolder)
        ).sort((a,b) => parseFloat(a.split('_').pop()) - parseFloat(b.split('_').pop()))
    )
});

printSelectedVolumes(volumesToConvert);

wantCustomCover = await confirm({
    message: 'Do you want to add a custom cover to the PDF?\nℹ️ Note: if you select "No", the first page of the first volume will be used as cover.',
});

if (wantCustomCover) {
    let files = ThroughDirectory(ROOT_DIR).filter(file => file.endsWith('.png') || file.endsWith('.jpg'));
    customCoverImage = await search({
        message: 'Select the image you want to use as page cover:',
        source: async (input) => {
            if (!input) return files;
            return files.filter(file => file.includes(input));
        },
        validate: (input) => {
            if (input.length === 0) return 'No file found with that name.';
            return true;
        }
    });
}

wantChapterSeparator = await confirm({
    message: 'Do you want to add a separator between chapters?'
});

//log(info('\n##############################################'));
log(success('\n#### Operation completed ####\n'));
log(debug('Summary:'));
log(debug(`Selected manga: ${info(selectedMangaFolder)}`));
log(debug(`Selected volumes: ${info(volumesToConvert)}`));
log(debug(`Want custom cover: ${wantCustomCover ? success('Yes') : warning('No')}`));
if (wantCustomCover) log(debug(`Custom cover image: ${info(customCoverImage)}`));
log(debug(`Want chapter separator: ${wantChapterSeparator ? success('Yes') : warning('No')}\n\n`));


craftPDF(
    selectedMangaFolder,
    volumesToConvert,
    wantCustomCover ? customCoverImage : null,
    wantChapterSeparator
);

function findVolumes(folderPath) {
    return findDirectories(folderPath);
}

function findManga(folderPath) {
    return findDirectories(folderPath);
}

function findDirectories(folderPath) {
    return readdirSync(folderPath, {
        withFileTypes: true
    }).filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
}

function convertStringArrayToObjectArray(stringArray) {
    return stringArray.map(str => {
        return {
            name: str,
            value: str
        };
    });
}

function ThroughDirectory(Directory) {
    readdirSync(Directory).forEach(File => {
        const Absolute = path.join(Directory, File);
        if (statSync(Absolute).isDirectory()) return ThroughDirectory(Absolute);
        else return files.push(Absolute);
    });

    return files;
}

function abort(){
    console.log('Operation aborted.');
    process.exit(1);
}

function printSelectedVolumes(vols) {
    let str = "";
    vols.forEach((vol, index) => {
        if (index === vols.length-1) {
            str += vol;
        }else{
            str += vol + ", ";
        }
    });
    log(info('Volume selected: ') + success(str));
}

/**
 * Craft the PDF
 * @param mangaFolder {string} Path to the manga folder
 * @param selectedVolumes {Array<string>} Array of selected volumes
 * @param customCover {string | null} Path to the custom cover image or null
 * @param chapterSeparator {boolean} Boolean to add a separator between chapters
 */
function craftPDF(mangaFolder, selectedVolumes, customCover, chapterSeparator=false){
    selectedVolumes.forEach(volume => {
        craftVolumePDF(join(ROOT_DIR, mangaFolder, volume), mangaFolder, chapterSeparator);
    });

    log(success(`All volumes of ${mangaFolder} successfully converted to PDF.`));
}

function craftVolumePDF(volumeFolder, mangaName, chapterSeparator=false){
    const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
        putOnlyUsedFonts: true,
        floatPrecision: 16 // or "smart", default is 16
    });

    const CHAPTER_FOLDER_LIST = findVolumes(volumeFolder);
    printSelectedVolumes(CHAPTER_FOLDER_LIST);

    let pageNumber = 1;

    CHAPTER_FOLDER_LIST.forEach((chapter) => {
        const chapterPath = join(volumeFolder, chapter);
        const images = readdirSync(chapterPath).filter(file => file.endsWith('.png') || file.endsWith('.jpg'));

        if (images.length === 0) {
            log(error(`There are no images in the ${chapterPath}.`));
            abort();
        }

        images.sort((a, b) => parseFloat(a) - parseFloat(b));

        //console.log(`${chapter}`);

        if (customCoverImage !== null && (chapterSeparator || pageNumber === 1)){
            //log(debug(`Adding custom cover image: ${customCoverImage}`));
            images.unshift(customCoverImage);
        }

        images.forEach((image, index) => {
            let imgData;
            let img;

            if (customCoverImage !== null && index === 0){
                imgData = readFileSync(customCoverImage).toString('base64');
                img = `data:image/${customCoverImage.split('.').pop().toLowerCase()};base64,${imgData}`;
            }else{
                const imagePath = join(chapterPath, image);
                imgData = readFileSync(imagePath).toString('base64');
                img = `data:image/${image.split('.').pop().toLowerCase()};base64,${imgData}`;
            }

            const imgProps = pdf.getImageProperties(img);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            if (index > 0 || pageNumber !== 1) {
                pdf.addPage();
                pageNumber++;
            }

            pdf.addImage(img, image.split('.').pop().toUpperCase(), 0, 0, pdfWidth, pdfHeight);
        });

        log(info(`Chapter ${chapter} successfully converted.`));

        if (pageNumber !== pdf.getNumberOfPages()){
            // FIXME: Check if this is necessary and what to do with it
            //console.warn(`Attenzione: il numero di pagine del PDF (${pdf.getNumberOfPages()}) non corrisponde al numero di pagine convertite (${pageNumber}).`);
            //pdf.save(join(chapter + ' - debug.pdf'));
        }
    });

    if (pageNumber !== pdf.getNumberOfPages()){
        log(error(`Error: The number of pages in the PDF (${pdf.getNumberOfPages()}) does not match the number of converted pages (${pageNumber}).`));
        abort();
    }

    let pdfName = `${mangaName.replaceAll(':', '')} - ${volumeFolder.split('/').pop()}.pdf`;

    // Salva il PDF
    pdf.save(join(ROOT_DIR, mangaName, pdfName));
    log(success(`PDF successfully generated: ${debug(volumeFolder)}\n`));
}