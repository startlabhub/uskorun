import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={
 title:"USKORUN — Move more. Get rewarded.",
 description:"Join Greater Sacramento running and walking challenges. Turn your movement into local rewards.",
 robots:{index:false,follow:false}
};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en"><body>{children}</body></html>;
}
