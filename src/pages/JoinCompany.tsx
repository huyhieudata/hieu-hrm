import { Link } from "react-router-dom";
import { AlertCircle, LogIn } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** /tham-gia: tính năng mời qua email đã ngừng — tài khoản nay do quản trị tạo trực tiếp. */
const JoinCompany = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
    <Logo />
    <Card className="w-full max-w-[440px] p-6 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-warning" />
      <h1 className="mt-3 text-[16px] font-semibold">Tính năng mời đã ngừng</h1>
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        Tính năng mời đã ngừng, vui lòng liên hệ quản trị để được cấp tài khoản. Tên đăng nhập và mật khẩu tạm sẽ
        được gửi qua email của bạn.
      </p>
      <Button asChild className="mt-4 gap-1.5">
        <Link to="/login">
          <LogIn className="h-4 w-4" /> Đến trang đăng nhập
        </Link>
      </Button>
    </Card>
  </div>
);

export default JoinCompany;
