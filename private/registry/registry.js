import {
    createResumeDump,
    getResumeDumpPoll,
    getResumeDump,
    saveResumeDump,
    runDumpAction,
} from "../objects/resume-dump.js";
import {
    createJobApplication,
    getJobApplicationPoll,
    listJobApplications,
    saveJobApplicationResume,
} from "../objects/job-application.js";
import {
    runJobSearch,
    getSearchState,
    getOrSeedPreferences,
    savePreferences,
    dismiss as dismissLead,
} from "../objects/job-search.js";

const registry = new Map();

registry.set("registry-dump:POST", createResumeDump);
registry.set("registry-dump:GET",  getResumeDumpPoll);   // ?ping=true — background job done yet?
registry.set("registry-dump:LOAD", getResumeDump);       // no ping — does this user have a dump?
registry.set("registry-dump:PUT",  saveResumeDump);      // user edits, and finalizing the review
registry.set("registry-dump:ACT",  runDumpAction);       // regenerate / recover / clear-cache

registry.set("job-application:POST", createJobApplication);       // background: AI + insert
registry.set("job-application:GET",  getJobApplicationPoll);      // ?id=… — does the row exist yet?
registry.set("job-application:LIST", listJobApplications);        // no id — all of the user's applications
registry.set("job-application:PUT",  saveJobApplicationResume);   // user edits to the built resume

registry.set("job-search:RUN",     runJobSearch);            // background: Perplexity + insert new leads
registry.set("job-search:GET",     getSearchState);          // leads, preferences and run state
registry.set("job-search:FORM",    getOrSeedPreferences);    // ?form=1 — stored prefs, or a guess from the dump
registry.set("job-search:PREFS",   savePreferences);         // user edits to the search preferences
registry.set("job-search:DISMISS", dismissLead);             // hide a lead from future runs

export const fnRegistry = (dir) => {
    console.log("fn registry");
    return registry.get(dir);
}