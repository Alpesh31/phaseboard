'use client';
import {createContext,useContext} from 'react';
export type MenuActions={manageUsers?:()=>void;managePhases?:()=>void};
export type MenuContext={registerActions:(actions:MenuActions)=>()=>void};
export const ProfileMenuContext=createContext<MenuContext>({registerActions:()=>()=>{}});
export const useProfileMenu=()=>useContext(ProfileMenuContext);
