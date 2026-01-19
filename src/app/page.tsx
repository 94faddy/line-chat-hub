'use client';

import Link from 'next/link';
import { FiMessageCircle, FiUsers, FiZap, FiShield, FiLayers, FiBarChart2 } from 'react-icons/fi';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-line-green rounded-xl flex items-center justify-center">
                <FiMessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">BevChat Hub</span>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href="/auth/login" 
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                เข้าสู่ระบบ
              </Link>
              <Link 
                href="/auth/register" 
                className="btn btn-primary"
              >
                สมัครสมาชิก
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <FiZap className="w-4 h-4" />
            รวมแชท LINE OA ทั้งหมดไว้ในที่เดียว
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            จัดการแชท <span className="text-line-green">LINE OA</span>
            <br />หลายเพจได้ง่ายขึ้น
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            รวมแชทจากทุก LINE Official Account มาไว้ในที่เดียว 
            ตอบแชทได้เร็วขึ้น ไม่พลาดทุกข้อความจากลูกค้า
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register" className="btn btn-primary text-lg px-8 py-3">
              เริ่มต้นใช้งานฟรี
            </Link>
            <Link href="#features" className="btn btn-outline text-lg px-8 py-3">
              ดูฟีเจอร์ทั้งหมด
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              ฟีเจอร์ครบครัน
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              ออกแบบมาเพื่อช่วยให้คุณจัดการแชทได้อย่างมีประสิทธิภาพ
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: FiLayers,
                title: 'รวมแชทหลายเพจ',
                description: 'เชื่อมต่อ LINE OA หลายเพจ และดูแชททั้งหมดในที่เดียว พร้อมแท็กบอกว่ามาจากเพจไหน'
              },
              {
                icon: FiMessageCircle,
                title: 'ตอบแชทง่าย',
                description: 'ส่งข้อความ รูปภาพ และ Sticker ได้ทันที พร้อมข้อความตอบกลับด่วน'
              },
              {
                icon: FiUsers,
                title: 'เพิ่มแอดมิน',
                description: 'เชิญทีมงานมาช่วยตอบแชท กำหนดสิทธิ์แยกแต่ละเพจได้'
              },
              {
                icon: FiBarChart2,
                title: 'ติดแท็กจัดกลุ่ม',
                description: 'สร้างแท็กสีสันสวยงาม จัดกลุ่มลูกค้าตามสถานะได้ง่าย'
              },
              {
                icon: FiZap,
                title: 'ตอบกลับอัตโนมัติ',
                description: 'ตั้งค่าข้อความตอบกลับอัตโนมัติเมื่อมีคำที่กำหนด'
              },
              {
                icon: FiShield,
                title: 'ปลอดภัย',
                description: 'ข้อมูลถูกเข้ารหัส ยืนยันตัวตนด้วยอีเมล ปลอดภัยสูง'
              }
            ].map((feature, index) => (
              <div key={index} className="card p-6 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-line-green" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-line-green to-green-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            พร้อมเริ่มใช้งานแล้วหรือยัง?
          </h2>
          <p className="text-green-100 text-lg mb-8">
            สมัครสมาชิกฟรี เชื่อมต่อ LINE OA ของคุณได้ทันที
          </p>
          <Link href="/auth/register" className="inline-flex items-center gap-2 bg-white text-line-green px-8 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors">
            <FiMessageCircle className="w-5 h-5" />
            สมัครสมาชิกฟรี
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-line-green rounded-lg flex items-center justify-center">
                <FiMessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-semibold">BevChat Hub</span>
            </div>
            <p className="text-sm">
              © {new Date().getFullYear()} BevChat Hub. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
