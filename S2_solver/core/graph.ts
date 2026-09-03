/**
 * graph.ts — graf więzów i odległości od GROUND (BFS).
 * Port 1:1 z @@BLENDER/S2_solver/core/graph.py
 */

export class ConstraintGraph {
    groundIds: Set<string> = new Set();
    edges: Record<string, string[]> = {};
    private _groundDistances: Record<string, number> = {};

    computeGroundDistances(groundIds: Set<string>, edges: Record<string, string[]>): Record<string, number> {
        this.groundIds = groundIds;
        this.edges = edges;
        this._groundDistances = {};

        const queue: Array<[string, number]> = [];
        for (const groundId of groundIds) {
            queue.push([groundId, 0]);
            this._groundDistances[groundId] = 0;
        }

        const visited = new Set(groundIds);
        while (queue.length > 0) {
            const [currentId, distance] = queue.shift()!;
            for (const neighborId of this.edges[currentId] ?? []) {
                if (visited.has(neighborId)) {
                    continue;
                }
                visited.add(neighborId);
                const newDistance = distance + 1;
                this._groundDistances[neighborId] = newDistance;
                queue.push([neighborId, newDistance]);
            }
        }

        return this._groundDistances;
    }

    getDistance(objId: string): number {
        return this._groundDistances[objId] ?? 999;
    }

    /**
     * Węzły połączone więzami innymi niż GROUND (BFS).
     * Węzły uziemione (anchor GROUND) są pomijane — nie ruszają się z grupą.
     */
    static getConnectedComponent(
        startId: string,
        edges: Record<string, string[]>,
        fixedIds: Set<string>,
    ): Set<string> {
        const component = new Set<string>();
        if (fixedIds.has(startId)) {
            return component;
        }

        const queue = [startId];
        component.add(startId);

        while (queue.length > 0) {
            const currentId = queue.shift()!;
            for (const neighborId of edges[currentId] ?? []) {
                if (fixedIds.has(neighborId) || component.has(neighborId)) {
                    continue;
                }
                component.add(neighborId);
                queue.push(neighborId);
            }
        }

        return component;
    }
}
