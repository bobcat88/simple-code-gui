import { invoke } from '@tauri-apps/api/core';

async function validatePromotion() {
    const cwd = '/home/_johan/Documents/Projects/simple-code-gui';
    const seedId = 'test-seed';
    
    console.log('--- Phase 1: List Seeds ---');
    const seeds = await invoke('gsd_list_seeds', { cwd });
    console.log('Seeds:', JSON.stringify(seeds, null, 2));
    
    const testSeed = seeds.find(s => s.id === seedId);
    if (!testSeed) {
        throw new Error('Test seed not found in list');
    }
    
    console.log('\n--- Phase 2: Promote to Draft ---');
    const moduleId = 'test-seed-module';
    const content = `title: Test Seed Module\ntype: module\nstatus:\n  maturity: draft\ndescription: Draft created from a brainstorm seed.\nacceptance_criteria:\n  - id: ac-1\n    given: Test Seed\n    when: this seed is promoted into implementation work\n    then: the desired outcome is specified and testable\n`;
    
    await invoke('kspec_write_draft', { cwd, module_id: moduleId, content });
    console.log('Draft written.');
    
    await invoke('gsd_update_seed_status', { cwd, seed_id: seedId, status: 'promoted_to_draft' });
    console.log('Seed status updated.');
    
    console.log('\n--- Phase 3: List Drafts ---');
    const drafts = await invoke('kspec_list_drafts', { cwd });
    console.log('Drafts:', JSON.stringify(drafts, null, 2));
    
    console.log('\n--- Phase 4: Verify Seed File ---');
    const updatedSeeds = await invoke('gsd_list_seeds', { cwd });
    const updatedSeed = updatedSeeds.find(s => s.id === seedId);
    console.log('Updated Seed:', JSON.stringify(updatedSeed, null, 2));
}

validatePromotion().catch(console.error);
