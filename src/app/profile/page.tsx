"use client";

import { useEffect } from "react";

export default function ProfileIndex() {
  useEffect(() => {
    const section = window.location.hash.slice(1);
    const destination = ["orders", "discount", "promos"].includes(section) ? section : "orders";
    window.location.replace(`/profile/${destination}`);
  }, []);
  return <main className="profile-loading">Открываем личный кабинет…</main>;
}
