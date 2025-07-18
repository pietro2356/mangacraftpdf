#!/usr/bin/env node

import {confirm, select, number, search} from '@inquirer/prompts';

let defaultFormat = null;

defaultFormat = await confirm({
    message: 'Do you want to use the default format (A4) for the PDF?',
});

console.log(`Default format selected: ${defaultFormat ? 'Yes' : 'No'}`);

const formats = ["A4", "Letter", "Legal", "A5", "B5", "Custom"];

let selectedFormat = await select({
    message: 'Select the format for the PDF:',
    choices: formats.map(format => ({name: format, value: format})),
    default: defaultFormat ? "A4" : "Custom"
});

console.log(`Selected format: ${selectedFormat}`);

if(selectedFormat === "Custom") {
    const customWidth = await number({
        message: 'Enter the custom width for the PDF:',
    });

    const customHeight = await number({
        message: 'Enter the custom height for the PDF:',
    });

    selectedFormat = [+customWidth, +customHeight];

    console.log(`Custom format selected: [${selectedFormat}] -> ${Array.isArray(selectedFormat)}`);
}