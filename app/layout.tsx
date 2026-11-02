import type {Metadata} from 'next';
export const metadata:Metadata={title:'设计质量检测验收',description:'导入设计文档并分析质量'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
