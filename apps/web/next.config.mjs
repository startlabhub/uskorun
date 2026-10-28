const nextConfig = {
 reactStrictMode: true, poweredByHeader: false,
 async headers(){return [{source:'/(.*)',headers:[{key:'Referrer-Policy',value:'no-referrer'},
   {key:'X-Content-Type-Options',value:'nosniff'}]}]}
};
export default nextConfig;
