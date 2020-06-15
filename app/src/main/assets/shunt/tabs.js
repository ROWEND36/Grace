function Tab(el){
    const self = this;
    var tabs = el.find(".tab a");
    tabs.each(function(e){
        $($(this).attr('href')).hide()
    })
    var activeLink = tabs.filter(".active");
    if(activeLink.length<1)activeLink = $(tabs[0]).addClass("active")
    var active = $(activeLink.attr("href"))
    active.show()
    el.on("click", ".tab", function(e){
        if(self.beforeClick)
            if (self.beforeClick($(this),activeLink)==false)
                return;
        activeLink.removeClass("active");
        activeLink = $(this).children();
        activeLink.addClass("active");
        e.stopPropagation();
        if(self.afterClick)
            if (self.afterClick(activeLink))return;
        active.hide();
        active = $(activeLink.attr('href'));
        active.show();
        
    });
    this.getActiveTab = function(){
        return activeLink;
    }
    this.select = function(id){
        el.find(".tab a").filter("[href=\"#"+id+"\"]").click()
    }
}
function SideNav(toggle){
    function openSideNav(){
        var sidenav = $("#"+$(toggle).attr("data-target"))
        console.log(sidenav)
        $(".sidenav-push").css("transform","translateX("+300+"px)")
        sidenav.css("transform","translateX("+0+")");
    }
    $(toggle).click(openSideNav)
}