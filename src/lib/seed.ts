import { BoardData } from './types';
export const seed: BoardData = {
 projectName:'My Personal Project',
 phases:[
  {id:'ideas',name:'Ideas / To-Do'},
  {id:'phase-1',name:'Phase 1'},
  {id:'phase-2',name:'Phase 2'},
  {id:'phase-3',name:'Phase 3'},
  {id:'phase-4',name:'Phase 4'}
 ],
 tasks:[
  {id:'t1',title:'Capture a new feature idea',description:'Use this inbox for thoughts before deciding which phase they belong in.',priority:'Medium',status:'Not Started',owner:'Me',contributors:[],dueDate:'',phaseId:'ideas'},
  {id:'t2',title:'Define MVP scope',description:'Agree on the first release and success criteria.',priority:'High',status:'Completed',owner:'Me',contributors:['Friend'],dueDate:'2026-10-10',phaseId:'phase-1'},
  {id:'t3',title:'Build core workflow',description:'Implement the most important MVP functionality.',priority:'High',status:'In Progress',owner:'Me',contributors:[],dueDate:'2026-10-15',phaseId:'phase-2'}
 ]
};
