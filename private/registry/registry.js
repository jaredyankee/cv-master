import { createResumeDump, getResumeDumpPoll, getResumeDump, saveResumeDump } from "../objects/resume-dump.js";
import {
    createJobApplication,
    getJobApplicationPoll,
    listJobApplications,
    saveJobApplicationResume,
} from "../objects/job-application.js";

const registry = new Map();

registry.set("registry-dump:POST", createResumeDump);
registry.set("registry-dump:GET",  getResumeDumpPoll);   // ?ping=true — background job done yet?
registry.set("registry-dump:LOAD", getResumeDump);       // no ping — does this user have a dump?
registry.set("registry-dump:PUT",  saveResumeDump);      // user edits, and finalizing the review

registry.set("job-application:POST", createJobApplication);       // background: AI + insert
registry.set("job-application:GET",  getJobApplicationPoll);      // ?id=… — does the row exist yet?
registry.set("job-application:LIST", listJobApplications);        // no id — all of the user's applications
registry.set("job-application:PUT",  saveJobApplicationResume);   // user edits to the built resume

export const fnRegistry = (dir) => {
    console.log("fn registry");
    return registry.get(dir);
}