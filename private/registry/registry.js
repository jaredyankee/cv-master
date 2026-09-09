import { createResumeDump, getResumeDumpPoll, getResumeDump } from "../objects/resume-dump.js";
import { createJobApplication, getJobApplicationPoll, listJobApplications } from "../objects/job-application.js";

const registry = new Map();

registry.set("registry-dump:POST", createResumeDump);
registry.set("registry-dump:GET",  getResumeDumpPoll);   // ?ping=true — background job done yet?
registry.set("registry-dump:LOAD", getResumeDump);       // no ping — does this user have a dump?

registry.set("job-application:POST", createJobApplication);   // background: AI + insert
registry.set("job-application:GET",  getJobApplicationPoll);  // ?id=… — does the row exist yet?
registry.set("job-application:LIST", listJobApplications);    // no id — all of the user's applications

export const fnRegistry = (dir) => {
    console.log("fn registry");
    return registry.get(dir);
}