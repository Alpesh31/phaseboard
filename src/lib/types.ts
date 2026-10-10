export type Priority = 'Low' | 'Medium' | 'High';
export type Status = 'Not Started' | 'In Progress' | 'Blocked' | 'Completed';
export type Importance = 'Must' | 'Maybe' | 'Mostly Not';
export type Attachment = { id: string; name: string; type: string; size: number };
export type Task = { id:string; title:string; description:string; priority:Priority; status:Status; importance:Importance; owner:string; contributors:string[]; dueDate:string; phaseId:string; attachments:Attachment[] };
export type Phase = { id:string; name:string };
export type BoardData = { projectName:string; phases:Phase[]; tasks:Task[] };
