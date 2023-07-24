import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

import ProjectLoader from '$lib/base/ProjectLoader';

export const load = (async ({ params }) => {
    const projectKey = params.key;
    const projectTuple = await ProjectLoader.loadProject(projectKey);
    if (!projectKey || !projectTuple) {
        throw error(404, `No project named "${projectKey}" exists!`);
    }
    return {
        projectKey,
        projectTuple
    };
}) satisfies PageLoad;
