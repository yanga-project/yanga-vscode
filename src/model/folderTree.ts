import { YangaComponent } from '../yanga/schema';

/**
 * Hierarchical view of a flat component list, derived from each component's
 * `path`. Single-child folder chains are collapsed into one node, e.g.
 * `src/lib/foo/comp` becomes a folder labelled `src/lib/foo` containing `comp`.
 *
 * Folders and components within a node are sorted alphabetically (by `name`).
 */
export interface ComponentFolder {
    /** Folder label, possibly a collapsed chain like `"a/b/c"`. Empty for the root. */
    name: string;
    /** Full path from the project root, joined with `/`. Empty for the root. */
    path: string;
    folders: ComponentFolder[];
    components: YangaComponent[];
}

interface RawNode {
    children: Map<string, RawNode>;
    components: YangaComponent[];
}

export function buildComponentFolderTree(components: YangaComponent[]): ComponentFolder {
    const root: RawNode = { children: new Map(), components: [] };
    for (const comp of components) {
        const segments = comp.path.split(/[/\\]/).filter(s => s.length > 0);
        const parentSegments = segments.slice(0, -1);
        let node = root;
        for (const seg of parentSegments) {
            let next = node.children.get(seg);
            if (!next) {
                next = { children: new Map(), components: [] };
                node.children.set(seg, next);
            }
            node = next;
        }
        node.components.push(comp);
    }
    return collapseAndSort(root, '', '');
}

function collapseAndSort(node: RawNode, name: string, currentPath: string): ComponentFolder {
    const folderEntries = [...node.children.entries()].sort(([a], [b]) => a.localeCompare(b));
    const folders: ComponentFolder[] = [];

    for (const [childName, child] of folderEntries) {
        // Single-child path collapse: while this folder has zero components
        // and exactly one folder child, merge the labels into "a/b".
        let label = childName;
        let cur = child;
        while (cur.components.length === 0 && cur.children.size === 1) {
            const [onlyName, onlyChild] = [...cur.children.entries()][0];
            label = `${label}/${onlyName}`;
            cur = onlyChild;
        }
        const folderPath = currentPath ? `${currentPath}/${label}` : label;
        folders.push(collapseAndSort(cur, label, folderPath));
    }

    const components = [...node.components].sort((a, b) => a.name.localeCompare(b.name));

    return { name, path: currentPath, folders, components };
}
