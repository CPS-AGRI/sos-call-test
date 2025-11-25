import "../styles/globals.css";
import { useEffect } from "react";

export default function App({ Component, pageProps }: any) {
  useEffect(() => {
    fetch("/api/sos/socket");
  }, []);

  return <Component {...pageProps} />;
}
