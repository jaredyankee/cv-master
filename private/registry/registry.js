import { createResumeDump, getResumeDumpPoll, getResumeDump } from "../objects/resume-dump.js";

const registry = new Map();

registry.set("registry-dump:POST", createResumeDump);
registry.set("registry-dump:GET",  getResumeDumpPoll);   // ?ping=true — background job done yet?
registry.set("registry-dump:LOAD", getResumeDump);       // no ping — does this user have a dump?

export const fnRegistry = (dir) => {
    console.log("fn registry");
    return registry.get(dir);
}