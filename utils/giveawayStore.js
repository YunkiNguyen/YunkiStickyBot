import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const FILE = path.join(
    __dirname,
    "../data/giveaways.json"
);


function init(){

    if(!fs.existsSync(FILE)){

        fs.mkdirSync(
            path.dirname(FILE),
            {
                recursive:true
            }
        );

        fs.writeFileSync(
            FILE,
            "{}"
        );

    }

}



export function loadGiveaways(){

    init();

    return JSON.parse(
        fs.readFileSync(
            FILE,
            "utf8"
        )
    );

}



export function saveGiveaways(data){

    init();

    fs.writeFileSync(
        FILE,
        JSON.stringify(
            data,
            null,
            2
        )
    );

}



export function getGiveaway(id){

    const data =
        loadGiveaways();

    return data[id];

}



export function setGiveaway(id,value){

    const data =
        loadGiveaways();

    data[id] = value;

    saveGiveaways(data);

}



export function removeGiveaway(id){

    const data =
        loadGiveaways();

    delete data[id];

    saveGiveaways(data);

}