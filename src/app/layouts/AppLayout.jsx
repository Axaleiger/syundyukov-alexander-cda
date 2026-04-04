import React,{ useState } from "react";
import { Outlet } from "react-router-dom";
import styles from './AppLayout.module.css';
import { useAppStore } from '../../core/store/appStore'
import { HeaderMain } from "../../shared/ui/Header/HeaderMain";
import { SidebarMain } from "../../shared/ui/Sidebar/SidebarMain";
import { SecondarySidebar } from '../../shared/ui/SecondarySidebar/SecondarySidebar'



export const AppLayout = () => {

  return <div className={`${styles.app} ${styles[ 'app-with-sidebar' ]}`}>
    <HeaderMain />

    <div className={styles[ 'app-body' ]}>
      <SidebarMain />
      <SecondarySidebar />
      <main className={styles[ 'app-main' ]}>
        <Outlet />
      </main>
    </div>
  </div>
}