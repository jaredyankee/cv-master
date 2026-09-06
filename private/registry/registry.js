import { createResumeDump, getResumeDumpPoll } from "../objects/resume-dump.js";

const registry = new Map();

registry.set("registry-dump:POST", createResumeDump);
registry.set("registry-dump:GET",  getResumeDumpPoll);

export const fnRegistry = (dir) => {
    console.log("fn registry");
    return registry.get(dir);
}