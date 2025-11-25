import "../styles/globals.css";
import { useEffect } from "react";

export default function App({ Component, pageProps }: any) {
  useEffect(() => {
    fetch("/sos/api/socket");
  }, []);

  return <Component {...pageProps} />;
}
