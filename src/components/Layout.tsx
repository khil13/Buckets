import { Outlet } from "react-router-dom";
import { NavBar } from "./NavBar";
import { ResponsibleGamblingFooter } from "./ResponsibleGamblingFooter";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4">
        <Outlet />
      </main>
      <ResponsibleGamblingFooter />
    </div>
  );
}
