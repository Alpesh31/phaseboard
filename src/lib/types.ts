export type Priority = 'Low' | 'Medium' | 'High';
export type Status = 'Not Started' | 'In Progress' | 'Blocked' | 'Completed';
export type Task = { id:string; title:string; description:string; priority:Priority; status:Status; owner:string; contributors:string[]; dueDate:string; phaseId:string };
export type Phase = { id:string; name:string };
export type BoardData = { projectName:string; phases:Phase[]; tasks:Task[] };
