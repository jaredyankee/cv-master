const registry = new Map();

registry.set("resume-dump:POST", "");

export const fnRegistry = (dir) => {
    return registry.get(dir);
}